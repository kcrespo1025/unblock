const IMG_RE = /^data:image\/(png|jpe?g|gif|webp);base64,/
const VID_RE = /^data:video\/(mp4|webm);base64,/

export function isImageDataUrl(u) {
  return typeof u === 'string' && IMG_RE.test(u)
}

export function isVideoDataUrl(u) {
  return typeof u === 'string' && VID_RE.test(u)
}

export function isHttpUrl(u) {
  return typeof u === 'string' && /^https?:\/\//.test(u)
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function downscaleImage(dataUrl, maxDim) {
  if (!/^data:image\/(png|jpeg);base64,/.test(dataUrl)) return Promise.resolve(dataUrl)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      if (scale >= 1) {
        resolve(dataUrl)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function checkVideoDuration(file, maxSeconds) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const done = (ok) => {
      URL.revokeObjectURL(url)
      resolve(ok)
    }
    video.onloadedmetadata = () => done(video.duration <= maxSeconds + 0.5)
    video.onerror = () => done(false)
    video.src = url
  })
}

export async function normalizeMediaFile(
  file,
  {
    maxImageBytes = 2 * 1024 * 1024,
    maxVideoBytes = 8 * 1024 * 1024,
    maxVideoSeconds = 10,
    maxDim = 512
  } = {}
) {
  const isImage = file.type && file.type.startsWith('image/')
  const isVideo = file.type === 'video/mp4' || file.type === 'video/webm'
  if (!isImage && !isVideo) throw new Error('Only images or MP4/WebM clips are supported')
  if (isImage && file.size > maxImageBytes) {
    throw new Error(`Image too large (max ${Math.round(maxImageBytes / 1024 / 1024)} MB)`)
  }
  if (isVideo && file.size > maxVideoBytes) {
    throw new Error(`Clip too large (max ${Math.round(maxVideoBytes / 1024 / 1024)} MB)`)
  }
  if (isVideo) {
    const ok = await checkVideoDuration(file, maxVideoSeconds)
    if (!ok) throw new Error(`Clip must be ${maxVideoSeconds} seconds or shorter`)
  }
  let dataUrl = await readFileAsDataURL(file)
  if (isImage) dataUrl = await downscaleImage(dataUrl, maxDim)
  return { dataUrl, name: file.name, type: file.type, size: file.size }
}

export function pickMediaFile(opts) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,video/mp4,video/webm'
    input.onchange = async () => {
      const file = input.files && input.files[0]
      if (!file) {
        resolve(null)
        return
      }
      try {
        resolve(await normalizeMediaFile(file, opts))
      } catch (err) {
        reject(err)
      }
    }
    input.onerror = () => reject(new Error('File selection failed'))
    input.click()
  })
}
