import { getStore, persist, uid, now, resetStore } from './store.js'
import { decText } from './cipher.js'
import crypto from 'node:crypto'

function hash(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

export function seedIfEmpty() {
  const store = getStore()
  const hasUsers = Object.keys(store.users).length > 0
  if (hasUsers) return
  seed()
}

function seed() {
  resetStore()
  const store = getStore()
  const t = now()

  const mkUser = (username, email, password, color, customStatus, extra = {}) => {
    const id = uid('u')
    const salt = extra.salt || crypto.randomBytes(8).toString('hex')
    store.users[id] = {
      id,
      username,
      email,
      passwordHash: extra.passwordHash || hash(password, salt),
      salt,
      color,
      status: 'online',
      customStatus: customStatus || null,
      avatar: extra.avatar || null,
      gradient: extra.gradient || null,
      banner: extra.banner || null,
      bio: extra.bio || null,
      pronoun: extra.pronoun || null,
      profileTheme: extra.profileTheme || null,
      decoration: extra.decoration || null,
      avatarMedia: extra.avatarMedia || null,
      title: extra.title || null,
      badges: extra.badges || null,
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorLast: null,
      backupCodes: null,
      createdAt: t
    }
    return id
  }

  const kmoon = mkUser(decText('enc:2908095959'), decText('enc:0906145344145c53000054070b25050954085d4d50595a'), '', '#ffd700', 'platform maintainer', {
    avatar: '🕳️',
    gradient: 'gold',
    banner: 'gold',
    pronoun: 'they/them',
    bio: 'Founder & platform developer. Built the underground from the ground up.',
    profileTheme: 'gold',
    decoration: 'crown',
    salt: '64117ba3591756d36ae376c8739e0865',
    passwordHash:
      'scrypt$16384$8$1$64117ba3591756d36ae376c8739e0865$faf60c2faa25dfc0a5df243bddd7398a3ad1291fc61b3ae601366d33e124da594f53eb52e608288e28515d9b5506ea845582133eb29e9a5bc512399f86e36a8f',
    title: { name: 'Platform Developer', color: '#ffd700', icon: '🛠️' },
    badges: [
      { id: 'owner', icon: '👑', name: 'Underground Owner', hint: 'Owner and founder of Underground. Built the platform from the ground up.' }
    ]
  })

  const serverId = uid('s')
  store.servers[serverId] = {
    id: serverId,
    name: 'Underground HQ',
    icon: '🕳️',
    iconMedia: null,
    description: 'The hidden place. 🕳️',
    banner: '🌑',
    ownerId: kmoon,
    admins: [],
    memberIds: [kmoon],
    channelIds: [],
    roles: {},
    memberRoles: {},
    bans: {},
    emojis: {},
    createdAt: t
  }

  const mkChannel = (name, topic, type = 'text') => {
    const id = uid('c')
    store.channels[id] = {
      id,
      serverId,
      name,
      topic,
      type,
      createdAt: t
    }
    store.servers[serverId].channelIds.push(id)
    return id
  }

  const general = mkChannel('general', 'Talk about anything at all')
  const announcements = mkChannel('announcements', 'Official news from the staff')
  const gaming = mkChannel('gaming', 'Game nights, ranks and clips')
  const memes = mkChannel('memes', 'Certified bangers only')
  const music = mkChannel('music', 'What are we listening to?')
  const help = mkChannel('help', 'Ask for help here')
  const offTopic = mkChannel('off-topic', 'Anything that doesn\u2019t fit elsewhere')
  const voice = mkChannel('General Voice', 'Hang out and talk', 'voice')
  const gamesVoice = mkChannel('Games', 'We play games', 'voice')

  const infoCat = uid('cat')
  const funCat = uid('cat')
  const vcCat = uid('cat')
  store.servers[serverId].categories = [
    { id: infoCat, name: 'Info' },
    { id: funCat, name: 'Fun & Games' },
    { id: vcCat, name: 'Voice' }
  ]
  const setCat = (chId, catId) => { store.channels[chId].categoryId = catId }
  setCat(announcements, infoCat)
  setCat(general, infoCat)
  setCat(gaming, funCat)
  setCat(memes, funCat)
  setCat(music, funCat)
  setCat(help, funCat)
  setCat(offTopic, funCat)
  setCat(voice, vcCat)
  setCat(gamesVoice, vcCat)

  const mkMsg = (channelId, authorId, content, extra = {}) => {
    const msg = {
      id: uid('m'),
      channelId,
      authorId,
      content,
      reactions: {},
      createdAt: extra.createdAt || t
    }
    if (extra.pinned) msg.pinned = true
    if (extra.replyTo) msg.replyTo = extra.replyTo
    store.messages[channelId] = store.messages[channelId] || []
    store.messages[channelId].push(msg)
    return msg
  }

  const welcome = (channelId) => {
    mkMsg(channelId, 'system', 'Welcome to the channel. This is the beginning of the history.', { createdAt: t })
  }

  welcome(announcements)
  mkMsg(announcements, kmoon, 'Welcome to **Underground HQ**! 🕳️', { createdAt: t })
  welcome(general)
  mkMsg(general, kmoon, 'hey, this is the general channel', { createdAt: t })
  welcome(gaming)
  mkMsg(gaming, kmoon, 'game nights go here', { createdAt: t })
  welcome(memes)
  mkMsg(memes, kmoon, 'memes only', { createdAt: t })
  welcome(music)
  mkMsg(music, kmoon, 'what are we listening to?', { createdAt: t })
  welcome(help)
  mkMsg(help, kmoon, 'ask for help here', { createdAt: t })
  welcome(offTopic)
  mkMsg(offTopic, kmoon, 'anything that doesn\u2019t fit elsewhere', { createdAt: t })

  const threadId = uid('t')
  store.threads = store.threads || {}
  store.threads[threadId] = {
    id: threadId,
    serverId,
    channelId: general,
    messageId: null,
    ownerId: kmoon,
    name: 'Sprint planning',
    memberIds: [kmoon],
    archived: false,
    createdAt: t,
    lastActivityAt: t
  }
  store.messages[threadId] = [
    { id: uid('m'), channelId: threadId, authorId: 'system', content: 'Thread started: **Sprint planning**', reactions: {}, createdAt: t },
    {
      id: uid('m'),
      channelId: threadId,
      authorId: kmoon,
      content: 'We ship the next release on Friday. Goals:\n- [ ] ship thread UI\n- [ ] fix the bugs\n- [ ] have fun',
      reactions: {},
      createdAt: t
    }
  ]

  store.friendships = []
  store.invites = store.invites || {}

  persist()
  console.log('Seeded new server. Account:')
  for (const id of Object.keys(store.users)) {
    const u = store.users[id]
    console.log(`  ${u.username}  ${u.email}  /  (scrypt-protected)`)
  }
}
