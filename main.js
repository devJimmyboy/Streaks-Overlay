/// <reference types="jquery" />
/// <reference types="gsap" />

function log(...message) {
  if (debug) {
    console.log(...message)
  }
}
const url = new URL(window.location.href)
var channel = url.searchParams.get('channel')
let debug = url.searchParams.get('debug') === '1'

const config = {
  streakEnabled: !!Number(url.searchParams.get('streakEnabled') || 1),
  showEmoteEnabled: !!Number(url.searchParams.get('showEmoteEnabled') || 1),
  showEmoteCooldown: Number(url.searchParams.get('showEmoteCooldown') || 6),
  showEmoteSizeMultiplier: Number(url.searchParams.get('showEmoteSizeMultiplier') || 1),
  minStreak: Number(url.searchParams.get('minStreak') || 5),
  emoteLocation: Number(url.searchParams.get('emoteLocation') || 1),
  emoteStreakEndingText: url.searchParams.get('emoteStreakText')?.replace(/(<([^>]+)>)/gi, '') ?? '{streak}x',
  showEmoteCooldownRef: new Date(),
  streakCooldown: new Date().getTime(),
  emotes: [],
}

const streaksEl = $('#streaks')

/**
 * @type {{ streaks: Streak[] }}
 */
var state = {
  streaks: [],
}
/**
 * @typedef {{ emote: {code: string; url: string;}; streak: number; cooldown: number }} Streak
 * @param {Streak} streak
 */
function addStreak(streak) {
  const streakProxy = new Proxy(streak, {
    set: (target, prop, value) => {
      if (prop === 'streak') {
        if (!!target.timeout) clearTimeout(target.timeout)
        if (value === 0) {
          state.streaks = state.streaks.filter((s) => s.emote.code !== target.emote.code)

          log('removed streak', streak)
        } else {
          target[prop] = value
          log('updated streak', streak)
          streak.timeout = setTimeout(() => {
            streakProxy.streak = 0
          }, 5000)
        }
      } else {
        target[prop] = value
      }
      return true
    },
  })

  state.streaks.push(streakProxy)
}

const getEmotes = async () => {
  const proxy = 'https://tpbcors.herokuapp.com/'
  log(config)

  if (!channel) return $('#errors').html(`Invalid channel. Please enter a channel name in the URL. Example: https://api.roaringiron.com/emoteoverlay?channel=forsen`)

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
    .catch(console.error)

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
    .catch(console.error)

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
    .catch(console.error)

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
    .catch(console.error)

  await (
    await fetch(proxy + `https://api.7tv.app/v2/users/${channel}/emotes`)
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
  if (config.emotes.length === 0) return

  const emoteUsedPos = rawMessage[4].startsWith('emotes=') ? 4 : rawMessage[5].startsWith('emote-only=') ? 6 : 5
  const emoteUsed = rawMessage[emoteUsedPos].split('emotes=').pop()
  const splitMessage = message.split(' ').filter((a) => !!a.length)
  let currentStreak = state.streaks.find((s) => splitMessage.includes(s.emote.code) || message === s.emote.code)
  if (currentStreak) currentStreak.streak++
  else if (rawMessage[emoteUsedPos].startsWith('emotes=') && emoteUsed.length > 1) {
    currentStreak = {}
    currentStreak.streak = 1
    currentStreak.emote = {
      code: message.substring(parseInt(emoteUsed.split(':')[1].split('-')[0]), parseInt(emoteUsed.split(':')[1].split('-')[1]) + 1),
    }
    currentStreak.emote.url = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteUsed.split(':')[0]}/default/dark/2.0`
    addStreak(currentStreak)
    log('created streak with', currentStreak)
  } else {
    currentStreak = {}
    currentStreak.streak = 1
    currentStreak.emote = { code: findInMessage(splitMessage) }
    currentStreak.emote.url = findUrlInEmotes(currentStreak.emote.code)
    if (currentStreak.emote.code) addStreak(currentStreak)
    log('created streak with', currentStreak)
  }
  streakEvent(currentStreak)
}

/**
 *
 * @param {Streak} currentStreak
 */
const streakEvent = (currentStreak) => {
  if (currentStreak.streak >= config.minStreak && config.streakEnabled) {
    log('Streak event', currentStreak)
    $('#main').css('position', 'absolute')
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

    switch (config.emoteLocation) {
      default:
      case 1:
        $('#main').css('bottom', '35')
        $('#main').css('left', '35')
        break
      case 2:
        $('#main').css('top', '35')
        $('#main').css('left', '35')
        break
      case 3:
        $('#main').css('bottom', '35')
        $('#main').css('right', '35')
        break
      case 4:
        $('#main').css('top', '35')
        $('#main').css('right', '35')
        break
    }
    if (currentStreak.emote.url) {
      streakImg.attr('src', currentStreak.emote.url)
      streakText.text(config.emoteStreakEndingText.replace('{streak}', currentStreak.streak))
    } else {
      streakText.text(config.emoteStreakEndingText.replace('{streak}', currentStreak.streak))
      streakText.append($(`<span class="streak-text-text">${currentStreak.emote.code}</span>`))
    }

    gsap.to(streak, {
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 0.15,
      onComplete: () => gsap.to(streak, { duration: 0.15, scaleX: 1, scaleY: 1 }),
    })

    currentStreak.cooldown = Date.now()
    setInterval(() => {
      if ((Date.now() - currentStreak.cooldown) / 1000 > 4) {
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

var connect = () => {
  const chat = new WebSocket('wss://irc-ws.chat.twitch.tv')
  const timeout = setTimeout(() => {
    chat.close()
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
    console.error('There was an error.. disconnected from the IRC')
    chat.close()
    chat.connect()
  }

  chat.onmessage = onMessage
}

function onMessage(event) {
  const fullMessage = event.data.split(/\r\n/)[0].split(`;`)
  if (fullMessage.length > 12) {
    const parsedMessage = fullMessage[fullMessage.length - 1].split(`${channel} :`).pop() // gets the raw message
    let message = parsedMessage.split(' ').includes('ACTION') ? parsedMessage.split('ACTION ').pop().split('')[0] : parsedMessage // checks for the /me ACTION usage and gets the specific message
    if (message.toLowerCase().startsWith('!showemote') || message.toLowerCase().startsWith('!#showemote')) {
      showEmote(message, fullMessage)
    }
    findEmotes(message, fullMessage)
  }
  if (fullMessage.length == 1 && fullMessage[0].startsWith('PING')) {
    log('sending pong')
    chat.send('PONG')
  }
}
