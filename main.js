/// <reference types="jquery" />
/// <reference types="gsap" />
/// <reference types="twemoji"/>
/// <reference types="howler"/>

var chat = null

const TIKTOK_ENDPOINT = 'https://tiktok-tts.weilnet.workers.dev'

function log(...message) {
  if (debug) {
    console.log(...message)
  }
}

function error(...message) {
  if (debug) {
    console.error(...message)
  }
}

/**
 * @type {HTMLAudioElement[]}
 */
const audioQueue = []

const url = new URL(window.location.href)
var channel = url.searchParams.get('channel')
// make a regex to identify any url
const urlRegex = /((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/g

var stvObjectId = null
let debug = url.searchParams.get('debug') === '1'
window.AudioContext = window.AudioContext || window.webkitAudioContext
var context = new AudioContext()

function getSetting(setting, defaultValue) {
  log('getting setting', setting, defaultValue, 'from url')
  // get setting from local storage
  let value = localStorage.getItem(setting)
  try {
    value = JSON.parse(value)
  } catch (e) {
    value = localStorage.getItem(setting)
  }
  if (url.searchParams.get(setting)) value = url.searchParams.get(setting)
  if (value) return value
  // get setting from url
  else return defaultValue
}

function setSetting(setting, value) {
  config[setting] = value
  localStorage.setItem(setting, JSON.stringify(value))
}
const config = {
  textColor: getSetting('textColor', '#55ccff'),
  streakEnabled: !!Number(getSetting('streakEnabled', 1)),
  showEmoteEnabled: !!Number(getSetting('showEmoteEnabled', 1)),
  showEmoteCooldown: Number(getSetting('showEmoteCooldown', 6)),
  showEmoteSizeMultiplier: Number(getSetting('showEmoteSizeMultiplier', 1)),
  minStreak: Number(getSetting('minStreak', 5)),
  emoteLocation: Number(getSetting('emoteLocation', 1)),
  emoteStreakEndingText: getSetting('emoteStreakText', '{streak}x')?.replace(/(<([^>]+)>)/gi, ''),
  tts: !!Number(getSetting('tts', 0)),
  ttsVoice: getSetting('ttsVoice', 'Brian'),
  streakText: Number(getSetting('streakText', 1)),
  showEmoteCooldownRef: new Date(),
  streakCooldown: new Date().getTime(),
  emotes: [],
}

document.body.style.setProperty('--text-color', config.textColor)

const streaksEl = $('#streaks')
const main = $('#main')

switch (config.emoteLocation) {
  default:
  case 1:
    main.css('bottom', '35px')
    main.css('left', '35px')
    document.body.style.setProperty('--streak-direction', 'column-reverse')
    break
  case 2:
    main.css('top', '35px')
    main.css('left', '35px')
    break
  case 3:
    main.css('bottom', '35px')
    main.css('right', '35px')
    document.body.style.setProperty('--streak-direction', 'column-reverse')
    break
  case 4:
    main.css('top', '35px')
    main.css('right', '35px')
    break
}

/**
 * @type {{ streaks: Streak[] }}
 */
var state = {
  streaks: [],
}
/**
 * @typedef {{ emote: {code: string; url: string;}; streak: number; cooldown: number; timeout?: number | null }} Streak
 * @param {Streak} streak
 */
function addStreak(streak) {
  if (config.streakText === 0 && streak.emote.url === null) return
  const streakProxy = new Proxy(streak, {
    set: (target, prop, value) => {
      if (prop === 'streak') {
        if (!!target.timeout) {
          clearTimeout(target.timeout)
          target.timeout = null
        }
        if (value === 0) {
          state.streaks = state.streaks.filter((s) => s.emote.code !== target.emote.code)

          log('removed streak', streak)
        } else {
          target[prop] = value
          log('updated streak', streak)
          streak.timeout = setTimeout(() => {
            streakProxy.streak = 0
          }, 10000)
        }
      } else {
        target[prop] = value
      }
      return true
    },
  })
  streakProxy.streak = 1
  streakProxy.timeout = setTimeout(() => {
    streakProxy.streak = 0
  }, 10000)

  state.streaks.push(streakProxy)
}

const getEmotes = async () => {
  const proxy = 'https://tpbcors.herokuapp.com/'
  log(config)

  if (!channel) return $('#errors').html(`Invalid channel. Please enter a channel name in the URL. Example: https://overlays.jimmyboy.dev/Streaks-Overlay/?channel=forsen`)

  const twitchId = (
    await (
      await fetch(proxy + 'https://api.ivr.fi/v2/twitch/user?login=' + channel, {
        headers: { 'User-Agent': 'overlays.jimmyboy.dev/emoteoverlay' },
      })
    ).json()
  )?.[0].id

  await (
    await fetch(proxy + 'https://api.frankerfacez.com/v1/room/' + channel)
  )
    .json()
    .then((data) => {
      const emoteNames = Object.keys(data.sets)
      for (let i = 0; i < emoteNames.length; i++) {
        for (let j = 0; j < data.sets[emoteNames[i]].emoticons.length; j++) {
          const emote = data.sets[emoteNames[i]].emoticons[j]
          config.emotes.push({
            name: emote.name,
            url: 'https://' + (emote.urls['2'] || emote.urls['1']).split('//').pop(),
          })
        }
      }
    })
    .catch(error)

  await (
    await fetch(proxy + 'https://api.frankerfacez.com/v1/set/global')
  )
    .json()
    .then((data) => {
      const emoteNames = Object.keys(data.sets)
      for (let i = 0; i < emoteNames.length; i++) {
        for (let j = 0; j < data.sets[emoteNames[i]].emoticons.length; j++) {
          const emote = data.sets[emoteNames[i]].emoticons[j]
          config.emotes.push({
            name: emote.name,
            url: 'https://' + (emote.urls['2'] || emote.urls['1']).split('//').pop(),
          })
        }
      }
    })
    .catch(error)

  await (
    await fetch(proxy + 'https://api.betterttv.net/3/cached/users/twitch/' + twitchId)
  )
    .json()
    .then((data) => {
      for (let i = 0; i < data.channelEmotes.length; i++) {
        config.emotes.push({
          name: data.channelEmotes[i].code,
          url: `https://cdn.betterttv.net/emote/${data.channelEmotes[i].id}/2x`,
        })
      }
      for (let i = 0; i < data.sharedEmotes.length; i++) {
        config.emotes.push({
          name: data.sharedEmotes[i].code,
          url: `https://cdn.betterttv.net/emote/${data.sharedEmotes[i].id}/2x`,
        })
      }
    })
    .catch(error)

  await (
    await fetch(proxy + 'https://api.betterttv.net/3/cached/emotes/global')
  )
    .json()
    .then((data) => {
      for (let i = 0; i < data.length; i++) {
        config.emotes.push({
          name: data[i].code,
          url: `https://cdn.betterttv.net/emote/${data[i].id}/2x`,
        })
      }
    })
    .catch(error)

  await (
    await fetch(proxy + 'https://api.7tv.app/v2/emotes/global')
  )
    .json()
    .then((data) => {
      for (let i = 0; i < data.length; i++) {
        config.emotes.push({
          name: data[i].name,
          url: data[i].urls[1][1],
        })
      }
    })
    .catch(console.error)

  await (
    await fetch(proxy + 'https://7tv.io/v3/users/twitch/' + twitchId)
  )
    .json()
    .then((data) => {
      // stvObjectId
      const emoteSet = data['emote_set']['emotes']
      for (let i = 0; i < emoteSet.length; i++) {
        config.emotes.push({
          name: emoteSet[i].name,
          url: 'https:' + emoteSet[i].data.host.url + '/' + emoteSet[i].data.host.files[2].name,
        })
      }
    })
    .catch(console.error)

  const successMessage = `Successfully loaded ${config.emotes.length} emotes for channel ${channel}`

  $('#errors').html(successMessage).delay(2000).fadeOut(300)
  log(successMessage, config.emotes)
}

const findInMessage = (message) => {
  for (const emote of config.emotes.map((a) => a.name)) {
    if (message.includes(emote)) {
      return emote
    }
  }
  return message.join(' ')
}

const findUrlInEmotes = (emote) => {
  for (const emoteObj of config.emotes) {
    if (emoteObj.name === emote) {
      return emoteObj.url
    }
  }
  return null
}

const getRandomCoords = () => [Math.floor(Math.random() * window.innerHeight), Math.floor(Math.random() * window.innerWidth)]

const showEmote = (message, rawMessage) => {
  if (config.showEmoteEnabled) {
    const emoteUsedPos = rawMessage[4].startsWith('emotes=') ? 4 : 5
    const emoteUsed = rawMessage[emoteUsedPos].split('emotes=').pop()
    const splitMessage = message.split(' ')

    if (emoteUsed.length === 0) {
      const url = findUrlInEmotes(findInMessage(splitMessage))
      if (url) return showEmoteEvent(url)
    } else {
      const url = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteUsed.split(':')[0]}/default/dark/2.0`
      return showEmoteEvent(url)
    }
  }
}

const findEmotes = (message, rawMessage) => {
  // if (config.emotes.length === 0) return
  state.streaks = state.streaks.filter((streak) => streak.streak > 0)
  const emoteUsedPos = rawMessage[4].startsWith('emotes=') ? 4 : rawMessage[5].startsWith('emote-only=') ? 6 : 5
  const emoteUsed = rawMessage[emoteUsedPos].split('emotes=').pop()
  const splitMessage = message.split(' ').filter((a) => !!a.length)
  let currentStreak = state.streaks.find((s) => splitMessage.includes(s.emote.code) || message === s.emote.code)
  if (currentStreak) currentStreak.streak = currentStreak.streak + 1
  else if (rawMessage[emoteUsedPos].startsWith('emotes=') && emoteUsed.length > 1) {
    currentStreak = {}
    currentStreak.streak = 0
    currentStreak.emote = {
      code: message.substring(parseInt(emoteUsed.split(':')[1].split('-')[0]), parseInt(emoteUsed.split(':')[1].split('-')[1]) + 1),
    }
    currentStreak.emote.url = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteUsed.split(':')[0]}/default/dark/2.0`
    addStreak(currentStreak)
    log('created streak with', currentStreak)
  } else {
    if (urlRegex.test(message)) return
    currentStreak = {}
    currentStreak.streak = 0
    currentStreak.emote = { code: findInMessage(splitMessage) }
    currentStreak.emote.url = findUrlInEmotes(currentStreak.emote.code)
    if (currentStreak.emote.code) addStreak(currentStreak)
    log('created streak with', currentStreak)
  }
  streakEvent(currentStreak)
}

const loadSound = async (url, type) => {
  const audio = await fetch(url).then((response) => response.blob())
  /**
   * @type {HTMLAudioElement}
   */
  const audioEl = document.createElement('audio')
  audioEl.src = URL.createObjectURL(audio)
  audioEl.load()

  return audioEl
}

/**
 *
 * @param {Streak} currentStreak
 */
const streakEvent = (currentStreak) => {
  if (config.streakText === 0 && currentStreak.emote.url === null) return

  if (currentStreak.streak >= config.minStreak && config.streakEnabled) {
    log('Streak event', currentStreak)

    let streak = $(`.streak[data-text="${currentStreak.emote.code}"]`)
    if (streak.length === 0) {
      streak = $(`<div class="streak" data-text="${currentStreak.emote.code}">
        <span class="streak-text">${currentStreak.streak}</span>
      </div>`)
      if (currentStreak.emote.url) {
        streak.append($(`<img src="${currentStreak.emote.url}" alt="${currentStreak.emote.code}" />`))
      }
      streak.prependTo(streaksEl)
    }

    let streakText = streak.children('.streak-text')
    let streakImg = streak.children('img')

    if (currentStreak.emote.url) {
      streakImg.attr('src', currentStreak.emote.url)
      streakText.text(config.emoteStreakEndingText.replace('{streak}', currentStreak.streak))
    } else {
      streakText.text(config.emoteStreakEndingText.replace('{streak}', currentStreak.streak))
      streakText.append($(`<span class="streak-text-text">${currentStreak.emote.code}</span>`))
    }
    twemoji.parse(streak.get(0))

    gsap.to(streak, {
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 0.15,
      onComplete: () =>
        gsap.to(streak, {
          duration: 0.15,
          scaleX: 1,
          scaleY: 1,
          onComplete: async (strek) => {
            if (strek.spoke || !config.tts) return

            const audio = await getTts(strek.emote.code)
            if (!audio) return
            currentStreak.spoke = true
            if (audioQueue.length === 0) audio.play()
            else if (audioQueue[0].paused) {
              audioQueue[0].play()
            }
            audioQueue.push(audio)
            audio.onended = function (e) {
              audioQueue.shift()
              URL.revokeObjectURL(this.src)
              if (audioQueue.length > 0) audioQueue[0].play()
            }
          },
          onCompleteParams: [currentStreak],
        }),
    })

    currentStreak.cooldown = Date.now()
    setInterval(() => {
      if ((Date.now() - currentStreak.cooldown) / 1000 > 8) {
        currentStreak.cooldown = Date.now()
        gsap.to(streak, {
          scaleX: 0,
          scaleY: 0,
          autoAlpha: 0,
          delay: 0.5,
          duration: 0.1,
          onComplete: (target) => {
            target.cooldown = Date.now()
            $(`.streak[data-text="${target.emote.code}"]`).remove()
            target.streak = 0
          },
          onCompleteParams: [currentStreak],
        })
      }
    }, 1000)
  }
}

const showEmoteEvent = (url) => {
  const secondsDiff = (new Date().getTime() - new Date(config.showEmoteCooldownRef).getTime()) / 1000

  if (secondsDiff > config.showEmoteCooldown) {
    config.showEmoteCooldownRef = new Date()

    $('#showEmote').empty()
    const [x, y] = getRandomCoords()
    $('#showEmote').css('position', 'absolute')
    $('#showEmote').css('left', x + 'px')
    $('#showEmote').css('top', y + 'px')

    $('<img />', {
      src: url,
      style: `scale:${config.showEmoteSizeMultiplier}, ${config.showEmoteSizeMultiplier}`,
    }).appendTo('#showEmote')

    gsap.to('#showEmote', 1, {
      autoAlpha: 1,
      onComplete: () => gsap.to('#showEmote', 1, { autoAlpha: 0, delay: 4, onComplete: () => $('#showEmote').empty() }),
    })
  }
}

function changeSettings(msg, fullMsg) {
  const splitMsg = msg.split(' ')
  const setting = splitMsg[0]
  let value = splitMsg[1]
  try {
    value = Number(value)
  } catch (e) {
    value = splitMsg[1]
  }
  if (!value || isNaN(value)) {
    value = splitMsg[1]
  }

  if (setting === 'streak') {
    config.streakEnabled = value === 'true'
  } else if (setting === 'tts') {
    setSetting('tts', value === 'true' ? 1 : 0)
  } else if (setting === 'ttsVoice') {
    setSetting('ttsVoice', value)
  } else if (setting === 'showEmote') {
    setSetting('showEmote', value === 'true')
  } else if (setting === 'showEmoteSizeMultiplier') {
    setSetting('showEmoteSizeMultiplier', value)
  } else if (setting === 'showEmoteCooldown') {
    setSetting('showEmoteCooldown', value)
  } else if (setting === 'showEmoteCooldownRef') {
    setSetting('showEmoteCooldownRef', value)
  } else if (setting === 'emoteStreakEndingText') {
    setSetting('emoteStreakEndingText', value)
  } else if (setting === 'minStreak') {
    setSetting('minStreak', value)
  } else if (setting === 'emoteLocation') {
    setSetting('emoteLocation', value)
    switch (config.emoteLocation) {
      default:
      case 1:
        main.css('bottom', '35px')
        main.css('left', '35px')
        document.body.style.setProperty('--streak-direction', 'column-reverse')
        break
      case 2:
        main.css('top', '35px')
        main.css('left', '35px')
        break
      case 3:
        main.css('bottom', '35px')
        main.css('right', '35px')
        document.body.style.setProperty('--streak-direction', 'column-reverse')
        break
      case 4:
        main.css('top', '35px')
        main.css('right', '35px')
        break
    }
  }
}

async function getTts(text) {
  const encodedText = encodeURIComponent(text)
  const isTiktok = config.ttsVoice.startsWith('tiktok:')
  const voice = isTiktok ? config.ttsVoice.replace('tiktok:', '') : config.ttsVoice
  let audio = ''
  if (isTiktok) {
    audio = await fetch(`${TIKTOK_ENDPOINT}/api/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voice,
      }),
    })
      .then((res) => res.json())
      .then((res) => res.data)
  } else {
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${config.ttsVoice}&text=` + encodeURIComponent(text)
    audio = await fetch(url).then((res) => res.blob())
  }
  if (!audio) return null
  const audioEl = new Audio()
  if (audio instanceof Blob) {
    audioEl.src = URL.createObjectURL(audio)
  }
  audioEl.src = `data:audio/mpeg;base64,${audio}`

  return audioEl
}

var connect = () => {
  connectChat()
  initEventApi()
}

var connectChat = () => {
  if (!WebSocket) {
    $('#errors').text('WebSocket is not supported by your browser.')
    return
  }
  chat = new WebSocket('wss://irc-ws.chat.twitch.tv')
  initEventApi()
  const timeout = setTimeout(() => {
    chat.connect()
  }, 10000)

  chat.onopen = function () {
    clearTimeout(timeout)
    chat.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership')
    chat.send('PASS oauth:xd123')
    chat.send('NICK justinfan123')
    chat.send('JOIN #' + channel)
    log('Connected to Twitch IRC')
    getEmotes()
  }

  chat.onerror = function () {
    error('There was an error.. disconnected from the IRC')

    chat.connect()
  }

  chat.onmessage = onMessage
}

function onMessage(event) {
  const fullMessage = event.data.split(/\r\n/)[0].split(`;`)
  if (fullMessage.includes(`USERNOTICE #${channel}`)) return
  if (fullMessage.length > 12) {
    const parsedMessage = fullMessage[fullMessage.length - 1].split(`${channel} :`).pop() // gets the raw message

    /**
     * @type {string}
     */
    let message = parsedMessage.split(' ').includes('ACTION') ? parsedMessage.split('ACTION ').pop().split('')[0] : parsedMessage // checks for the /me ACTION usage and gets the specific message
    if (message.toLowerCase().startsWith('!setting') || message.toLowerCase().startsWith('!#setting')) {
      changeSettings(message.split(' ').slice(1).join(' '), fullMessage)
    }
    if (message.toLowerCase().startsWith('http')) return
    findEmotes(message, fullMessage)
  }
  if (fullMessage.length == 1 && fullMessage[0].startsWith('PING')) {
    log('sending pong')
    chat.send('PONG')
  }
}

function initEventApi() {
  if (!WebSocket) {
    $('#errors').text('WebSocket is not supported by your browser.')
    return
  }
  const socket = new WebSocket('wss://events.7tv.io/v3')
  const timeout = setTimeout(() => {
    socket.connect()
  }, 10000)
  socket.onopen = () => {
    clearTimeout(timeout)
    log('Connected to 7TV Events')
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (stvObjectId) resolve(clearInterval(interval))
      }, 1000)
    }).then(() => {
      log('subscribing to set updates from', stvObjectId)
      socket.send(
        JSON.stringify({
          op: 35,
          d: {
            type: 'user.*',
            condition: {
              object_id: stvObjectId,
            },
          },
        })
      )
    })
  }
  socket.onerror = () => {
    error('There was an error.. disconnected from the Events')

    socket.connect()
  }
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data)
    switch (data.op) {
      case 0:
        /**
         * @type {DispatchEvent}
         */
        let d = data.d
        log(d)
        break
      case 1:
        log('Hello received with heartbeat interval of ' + data.d.heartbeat_interval / 1000 + ' seconds')
        break
      case 2:
        log('Heartbeat received')
        break
    }
  }
}
/**
 * @typedef {"system.announcement"|"emote.create"|"emote.update"|"emote.delete"|"emote_set.create"|"emote_set.update"|"emote_set.delete"} EventType
 * @typedef {{
 *  key: string;
 *  index: number;
 *  nested: boolean;
 *  old_value: Object | null;
 *  value: Object | null;
 * }} ChangeField
 * @typedef {{
 *  id: string;
 *  kind: number;
 *  actor: Object;
 *  added: ChangeField[];
 *  removed: ChangeField[];
 *  updated: ChangeField[];
 *  pushed: ChangeField[];
 *  pulled: ChangeField[];
 * }} ChangeMap
 * @typedef {{
 *  type: EventType;
 *  body: ChangeMap;
 * }} DispatchEvent
 */
