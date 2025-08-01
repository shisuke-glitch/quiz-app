{\rtf1\ansi\ansicpg932\cocoartf2820
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // main.js\
import \{ firebaseConfig \} from './firebase-config.js';\
\
// --- Firebase\uc0\u12398 \u21021 \u26399 \u21270  ---\
firebase.initializeApp(firebaseConfig);\
const db = firebase.database();\
\
// --- DOM\uc0\u35201 \u32032 \u12398 \u21462 \u24471  ---\
const screens = \{\
    login: document.getElementById('login-screen'),\
    waiting: document.getElementById('waiting-screen'),\
    game: document.getElementById('game-screen'),\
    result: document.getElementById('result-screen'),\
\};\
const loginError = document.getElementById('login-error');\
const joinRoomButton = document.getElementById('join-room-button');\
const roomNameInput = document.getElementById('room-name-input');\
const passwordInput = document.getElementById('password-input');\
const playerNameInput = document.getElementById('player-name-input');\
\
const waitingRoomName = document.getElementById('waiting-room-name');\
const waitingPlayerList = document.getElementById('waiting-player-list');\
const waitingMessage = document.getElementById('waiting-message');\
const startGameButton = document.getElementById('start-game-button');\
\
const scoreboard = \{\
    player1: document.getElementById('player1-score'),\
    player2: document.getElementById('player2-score'),\
\};\
const questionBox = document.getElementById('question-box');\
const gameStatus = document.getElementById('game-status');\
const buzzerButton = document.getElementById('buzzer-button');\
const answerForm = document.getElementById('answer-form');\
const answerInput = document.getElementById('answer-input');\
\
const resultMessage = document.getElementById('result-message');\
const finalScoreboard = document.getElementById('final-scoreboard');\
const newGameButton = document.getElementById('new-game-button');\
const goToLoginButton = document.getElementById('go-to-login-button');\
\
// --- \uc0\u12464 \u12525 \u12540 \u12496 \u12523 \u22793 \u25968  ---\
let currentRoomName = null;\
let currentPlayerId = null;\
let roomRef = null;\
let roomListener = null;\
\
const WIN_SCORE = 7;\
const LOSE_MISSES = 3;\
\
// --- \uc0\u30011 \u38754 \u36983 \u31227  ---\
function showScreen(screenName) \{\
    Object.values(screens).forEach(screen => screen.classList.remove('active'));\
    screens[screenName].classList.add('active');\
\}\
\
// --- Wikipedia\uc0\u12363 \u12425 \u12463 \u12452 \u12474 \u12434 \u29983 \u25104  ---\
async function generateQuiz() \{\
    try \{\
        const randomApiUrl = 'https://ja.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*';\
        const randomResponse = await fetch(randomApiUrl);\
        const randomData = await randomResponse.json();\
        const pageTitle = randomData.query.random[0].title;\
\
        const contentApiUrl = `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=$\{encodeURIComponent(pageTitle)\}&format=json&origin=*`;\
        const contentResponse = await fetch(contentApiUrl);\
        const contentData = await contentResponse.json();\
        const pageId = Object.keys(contentData.query.pages)[0];\
        let extract = contentData.query.pages[pageId].extract;\
\
        const question = extract.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '').trim().replace(/\\\uc0\u65288 .*\\\u65289 /g, '\u65288 ...\u65289 ');\
        const answer = pageTitle.replace(/_\\(.*\\)$/, '').trim();\
\
        if (question.length < 20 || answer.length < 2) \{\
            return generateQuiz(); // \uc0\u30701 \u12377 \u12366 \u12427 \u21839 \u38988 \u12399 \u20877 \u29983 \u25104 \
        \}\
        return \{ question, answer \};\
    \} catch (error) \{\
        console.error('\uc0\u12463 \u12452 \u12474 \u12398 \u29983 \u25104 \u12395 \u22833 \u25943 \u12375 \u12414 \u12375 \u12383 :', error);\
        return \{ question: '\uc0\u12463 \u12452 \u12474 \u12398 \u29983 \u25104 \u12395 \u22833 \u25943 \u12375 \u12414 \u12375 \u12383 \u12290 \u12522 \u12525 \u12540 \u12489 \u12375 \u12390 \u12367 \u12384 \u12373 \u12356 \u12290 ', answer: '' \};\
    \}\
\}\
\
\
// --- \uc0\u12523 \u12540 \u12512 \u12408 \u12398 \u21442 \u21152 /\u20316 \u25104 \u20966 \u29702  ---\
async function handleJoinRoom() \{\
    const roomName = roomNameInput.value.trim();\
    const password = passwordInput.value;\
    const playerName = playerNameInput.value.trim();\
\
    if (!roomName || !password || !playerName) \{\
        loginError.textContent = '\uc0\u12377 \u12409 \u12390 \u12398 \u38917 \u30446 \u12434 \u20837 \u21147 \u12375 \u12390 \u12367 \u12384 \u12373 \u12356 \u12290 ';\
        return;\
    \}\
\
    loginError.textContent = '';\
    currentRoomName = roomName;\
    roomRef = db.ref(`rooms/$\{currentRoomName\}`);\
\
    const snapshot = await roomRef.once('value');\
    const room = snapshot.val();\
\
    if (!room) \{ // \uc0\u26032 \u35215 \u12523 \u12540 \u12512 \u20316 \u25104 \
        currentPlayerId = 'player1';\
        const newRoomData = \{\
            password: password,\
            players: \{\
                player1: \{ name: playerName, score: 0, misses: 0, isReady: true \},\
            \},\
            gameState: 'waiting',\
        \};\
        await roomRef.set(newRoomData);\
    \} else \{ // \uc0\u26082 \u23384 \u12523 \u12540 \u12512 \u12395 \u21442 \u21152 \
        if (room.password !== password) \{\
            loginError.textContent = '\uc0\u12497 \u12473 \u12527 \u12540 \u12489 \u12364 \u36949 \u12356 \u12414 \u12377 \u12290 ';\
            return;\
        \}\
        if (room.players.player2 && room.players.player2.isReady) \{\
            loginError.textContent = '\uc0\u12371 \u12398 \u12523 \u12540 \u12512 \u12399 \u28288 \u21729 \u12391 \u12377 \u12290 ';\
            return;\
        \}\
        currentPlayerId = 'player2';\
        await roomRef.child('players/player2').set(\{ name: playerName, score: 0, misses: 0, isReady: true \});\
    \}\
\
    setupRoomListener();\
\}\
\
// --- \uc0\u12523 \u12540 \u12512 \u12398 \u29366 \u24907 \u12434 \u30435 \u35222  ---\
function setupRoomListener() \{\
    if (roomListener) roomRef.off('value', roomListener);\
    \
    roomListener = roomRef.on('value', (snapshot) => \{\
        const room = snapshot.val();\
        if (!room) \{ // \uc0\u12507 \u12473 \u12488 \u12364 \u36864 \u20986 \u12375 \u12383 \u22580 \u21512 \u12394 \u12393 \
            alert('\uc0\u12523 \u12540 \u12512 \u12364 \u21066 \u38500 \u12373 \u12428 \u12414 \u12375 \u12383 \u12290 \u12488 \u12483 \u12503 \u12506 \u12540 \u12472 \u12395 \u25147 \u12426 \u12414 \u12377 \u12290 ');\
            location.reload();\
            return;\
        \}\
        updateUI(room);\
    \});\
\
    // \uc0\u12502 \u12521 \u12454 \u12470 \u12434 \u38281 \u12376 \u12383 \u12392 \u12365 \u12395 \u12503 \u12524 \u12452 \u12516 \u12540 \u24773 \u22577 \u12434 \u21066 \u38500 \
    const playerRef = roomRef.child(`players/$\{currentPlayerId\}`);\
    playerRef.onDisconnect().remove();\
\}\
\
// --- UI\uc0\u12398 \u26356 \u26032  ---\
function updateUI(room) \{\
    // gameState\uc0\u12395 \u24540 \u12376 \u12390 \u30011 \u38754 \u12434 \u20999 \u12426 \u26367 \u12360 \
    if (room.gameState === 'finished') \{\
        showScreen('result');\
    \} else if (room.gameState === 'playing') \{\
        showScreen('game');\
    \} else \{\
        showScreen('waiting');\
    \}\
    \
    // \uc0\u24453 \u27231 \u30011 \u38754 \u12398 \u26356 \u26032 \
    waitingRoomName.textContent = `\uc0\u12523 \u12540 \u12512 \u21517 : $\{currentRoomName\}`;\
    waitingPlayerList.innerHTML = '';\
    Object.entries(room.players).forEach(([id, player]) => \{\
        const playerDiv = document.createElement('div');\
        playerDiv.textContent = `\uc0\u12539 $\{player.name\}`;\
        waitingPlayerList.appendChild(playerDiv);\
    \});\
\
    if (room.players.player1 && room.players.player2) \{\
        waitingMessage.textContent = '\uc0\u20840 \u21729 \u25539 \u12356 \u12414 \u12375 \u12383 \u65281 ';\
        startGameButton.classList.toggle('hidden', currentPlayerId !== 'player1');\
    \} else \{\
        waitingMessage.textContent = '\uc0\u30456 \u25163 \u12398 \u21442 \u21152 \u12434 \u24453 \u12387 \u12390 \u12356 \u12414 \u12377 ...';\
        startGameButton.classList.add('hidden');\
    \}\
\
    // \uc0\u23550 \u25126 \u30011 \u38754 \u12398 \u26356 \u26032 \
    updateScoreboard(room.players);\
    buzzerButton.disabled = false;\
    answerForm.classList.add('hidden');\
    gameStatus.textContent = '';\
\
    if (room.gameState === 'playing') \{\
        questionBox.innerHTML = room.currentQuestion.question;\
        \
        if (room.buzzer && room.buzzer.pressedBy) \{\
            buzzerButton.disabled = true;\
            const buzzerPlayerName = room.players[room.buzzer.pressedBy].name;\
            gameStatus.textContent = `$\{buzzerPlayerName\}\uc0\u12364 \u22238 \u31572 \u20013 ...`;\
            if (room.buzzer.pressedBy === currentPlayerId) \{\
                answerForm.classList.remove('hidden');\
                answerInput.focus();\
            \}\
        \}\
    \}\
\
    // \uc0\u32080 \u26524 \u30011 \u38754 \u12398 \u26356 \u26032 \
    if (room.gameState === 'finished') \{\
        resultMessage.textContent = room.winner === 'draw' ? '\uc0\u24341 \u12365 \u20998 \u12369 \u65281 ' : `$\{room.players[room.winner].name\}\u12398 \u21213 \u21033 \u65281 `;\
        finalScoreboard.innerHTML = '';\
        Object.values(room.players).forEach(player => \{\
            const scoreDiv = document.createElement('div');\
            scoreDiv.innerHTML = `$\{player.name\}: $\{player.score\}\uc0\u28857  / $\{player.misses\}\u12511 \u12473 `;\
            finalScoreboard.appendChild(scoreDiv);\
        \});\
        newGameButton.classList.toggle('hidden', currentPlayerId !== 'player1');\
    \}\
\}\
\
// --- \uc0\u12473 \u12467 \u12450 \u12508 \u12540 \u12489 \u12398 \u26356 \u26032  ---\
function updateScoreboard(players) \{\
    ['player1', 'player2'].forEach(id => \{\
        const scoreBox = scoreboard[id];\
        const player = players[id];\
        if (player) \{\
            scoreBox.innerHTML = `\
                <div class="name">$\{player.name\}</div>\
                <div class="score">$\{player.score\} \uc0\u28857 </div>\
                <div class="misses">$\{'x'.repeat(player.misses)\}</div>\
            `;\
            scoreBox.classList.remove('highlight');\
        \} else \{\
            scoreBox.innerHTML = '\uc0\u24453 \u27231 \u20013 ...';\
        \}\
    \});\
\}\
\
// --- \uc0\u12466 \u12540 \u12512 \u38283 \u22987  ---\
async function handleStartGame() \{\
    const newQuiz = await generateQuiz();\
    roomRef.update(\{\
        gameState: 'playing',\
        currentQuestion: newQuiz,\
        buzzer: null,\
    \});\
\}\
\
// --- \uc0\u26089 \u25276 \u12375 \u20966 \u29702  ---\
function handleBuzzerPress() \{\
    const buzzerRef = roomRef.child('buzzer');\
    buzzerRef.transaction(currentBuzzer => \{\
        if (currentBuzzer === null) \{\
            return \{ pressedBy: currentPlayerId, timestamp: firebase.database.ServerValue.TIMESTAMP \};\
        \}\
        return; // \uc0\u20182 \u12398 \u20154 \u12364 \u20808 \u12395 \u25276 \u12375 \u12383 \u12398 \u12391 \u20309 \u12418 \u12375 \u12394 \u12356 \
    \}).catch(error => \{\
        console.error("Buzzer transaction failed: ", error);\
    \});\
\}\
\
// --- \uc0\u22238 \u31572 \u20966 \u29702  ---\
async function handleAnswerSubmit(e) \{\
    e.preventDefault();\
    const submittedAnswer = answerInput.value.trim();\
    if (!submittedAnswer) return;\
\
    answerInput.value = '';\
\
    const roomSnapshot = await roomRef.once('value');\
    const room = roomSnapshot.val();\
    const correctAnswer = room.currentQuestion.answer;\
\
    let updates = \{\};\
    let isCorrect = submittedAnswer.toLowerCase() === correctAnswer.toLowerCase();\
\
    const currentPlayerState = room.players[currentPlayerId];\
    \
    if (isCorrect) \{\
        const newScore = currentPlayerState.score + 1;\
        updates[`/players/$\{currentPlayerId\}/score`] = newScore;\
        \
        if (newScore >= WIN_SCORE) \{\
            updates['/gameState'] = 'finished';\
            updates['/winner'] = currentPlayerId;\
        \} else \{\
            // \uc0\u27425 \u12398 \u21839 \u38988 \u12408 \
            const newQuiz = await generateQuiz();\
            updates['/currentQuestion'] = newQuiz;\
            updates['/buzzer'] = null;\
        \}\
    \} else \{\
        const newMisses = currentPlayerState.misses + 1;\
        updates[`/players/$\{currentPlayerId\}/misses`] = newMisses;\
\
        if (newMisses >= LOSE_MISSES) \{\
            updates['/gameState'] = 'finished';\
            const opponentId = currentPlayerId === 'player1' ? 'player2' : 'player1';\
            updates['/winner'] = opponentId;\
        \} else \{\
            // \uc0\u12466 \u12540 \u12512 \u20877 \u38283 \
            updates['/buzzer'] = null;\
        \}\
    \}\
\
    await roomRef.update(updates);\
\}\
\
// --- \uc0\u26032 \u12375 \u12356 \u12466 \u12540 \u12512 \u12434 \u22987 \u12417 \u12427  ---\
function handleNewGame() \{\
    // \uc0\u12473 \u12467 \u12450 \u12392 \u12511 \u12473 \u12434 \u12522 \u12475 \u12483 \u12488 \u12375 \u12390 \u24453 \u27231 \u30011 \u38754 \u12395 \u25147 \u12427 \
    const updates = \{\
        'gameState': 'waiting',\
        'players/player1/score': 0,\
        'players/player1/misses': 0,\
        'players/player2/score': 0,\
        'players/player2/misses': 0,\
        'currentQuestion': null,\
        'buzzer': null,\
        'winner': null\
    \};\
    roomRef.update(updates);\
\}\
\
// --- \uc0\u12452 \u12505 \u12531 \u12488 \u12522 \u12473 \u12490 \u12540 \u12398 \u35373 \u23450  ---\
joinRoomButton.addEventListener('click', handleJoinRoom);\
startGameButton.addEventListener('click', handleStartGame);\
buzzerButton.addEventListener('click', handleBuzzerPress);\
answerForm.addEventListener('submit', handleAnswerSubmit);\
newGameButton.addEventListener('click', handleNewGame);\
goToLoginButton.addEventListener('click', () => location.reload());\
\
// --- \uc0\u21021 \u26399 \u30011 \u38754 \u34920 \u31034  ---\
showScreen('login');}