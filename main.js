// main.js

// ▼▼▼ あなたのFirebase設定情報をここに貼り付け ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxxxxxxxxxxx"
};
// ▲▲▲ あなたのFirebase設定情報をここに貼り付け ▲▲▲

// --- Firebaseの初期化 ---
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- DOM要素の取得 ---
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
};
const loginError = document.getElementById('login-error');
const joinRoomButton = document.getElementById('join-room-button');
const roomNameInput = document.getElementById('room-name-input');
const passwordInput = document.getElementById('password-input');
const playerNameInput = document.getElementById('player-name-input');

const waitingRoomName = document.getElementById('waiting-room-name');
const waitingPlayerList = document.getElementById('waiting-player-list');
const waitingMessage = document.getElementById('waiting-message');
const startGameButton = document.getElementById('start-game-button');

const scoreboard = {
    player1: document.getElementById('player1-score'),
    player2: document.getElementById('player2-score'),
};
const questionBox = document.getElementById('question-box');
const gameStatus = document.getElementById('game-status');
const buzzerButton = document.getElementById('buzzer-button');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');

const resultMessage = document.getElementById('result-message');
const finalScoreboard = document.getElementById('final-scoreboard');
const newGameButton = document.getElementById('new-game-button');
const goToLoginButton = document.getElementById('go-to-login-button');

// --- グローバル変数 ---
let currentRoomName = null;
let currentPlayerId = null;
let roomRef = null;
let roomListener = null;

const WIN_SCORE = 7;
const LOSE_MISSES = 3;

// --- 画面遷移 ---
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- Wikipediaからクイズを生成 ---
async function generateQuiz() {
    try {
        const randomApiUrl = 'https://ja.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*';
        const randomResponse = await fetch(randomApiUrl);
        const randomData = await randomResponse.json();
        const pageTitle = randomData.query.random[0].title;

        const contentApiUrl = `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
        const contentResponse = await fetch(contentApiUrl);
        const contentData = await contentResponse.json();
        const pageId = Object.keys(contentData.query.pages)[0];
        let extract = contentData.query.pages[pageId].extract;

        const question = extract.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '').trim().replace(/\（.*\）/g, '（...）');
        const answer = pageTitle.replace(/_\(.*\)$/, '').trim();

        if (question.length < 20 || answer.length < 2) {
            return generateQuiz(); // 短すぎる問題は再生成
        }
        return { question, answer };
    } catch (error) {
        console.error('クイズの生成に失敗しました:', error);
        return { question: 'クイズの生成に失敗しました。リロードしてください。', answer: '' };
    }
}


// --- ルームへの参加/作成処理 ---
async function handleJoinRoom() {
    const roomName = roomNameInput.value.trim();
    const password = passwordInput.value;
    const playerName = playerNameInput.value.trim();

    if (!roomName || !password || !playerName) {
        loginError.textContent = 'すべての項目を入力してください。';
        return;
    }

    loginError.textContent = '';
    currentRoomName = roomName;
    roomRef = db.ref(`rooms/${currentRoomName}`);

    const snapshot = await roomRef.once('value');
    const room = snapshot.val();

    if (!room) { // 新規ルーム作成
        currentPlayerId = 'player1';
        const newRoomData = {
            password: password,
            players: {
                player1: { name: playerName, score: 0, misses: 0, isReady: true },
            },
            gameState: 'waiting',
        };
        await roomRef.set(newRoomData);
    } else { // 既存ルームに参加
        if (room.password !== password) {
            loginError.textContent = 'パスワードが違います。';
            return;
        }
        if (room.players.player2 && room.players.player2.isReady) {
            loginError.textContent = 'このルームは満員です。';
            return;
        }
        currentPlayerId = 'player2';
        await roomRef.child('players/player2').set({ name: playerName, score: 0, misses: 0, isReady: true });
    }

    setupRoomListener();
}

// --- ルームの状態を監視 ---
function setupRoomListener() {
    if (roomListener) roomRef.off('value', roomListener);
    
    roomListener = roomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (!room) { // ホストが退出した場合など
            alert('ルームが削除されました。トップページに戻ります。');
            location.reload();
            return;
        }
        updateUI(room);
    });

    // ブラウザを閉じたときにプレイヤー情報を削除
    const playerRef = roomRef.child(`players/${currentPlayerId}`);
    playerRef.onDisconnect().remove();
}

// --- UIの更新 ---
function updateUI(room) {
    // gameStateに応じて画面を切り替え
    if (room.gameState === 'finished') {
        showScreen('result');
    } else if (room.gameState === 'playing') {
        showScreen('game');
    } else {
        showScreen('waiting');
    }
    
    // 待機画面の更新
    waitingRoomName.textContent = `ルーム名: ${currentRoomName}`;
    waitingPlayerList.innerHTML = '';
    Object.entries(room.players).forEach(([id, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = `・${player.name}`;
        waitingPlayerList.appendChild(playerDiv);
    });

    if (room.players.player1 && room.players.player2) {
        waitingMessage.textContent = '全員揃いました！';
        startGameButton.classList.toggle('hidden', currentPlayerId !== 'player1');
    } else {
        waitingMessage.textContent = '相手の参加を待っています...';
        startGameButton.classList.add('hidden');
    }

    // 対戦画面の更新
    updateScoreboard(room.players);
    buzzerButton.disabled = false;
    answerForm.classList.add('hidden');
    gameStatus.textContent = '';

    if (room.gameState === 'playing') {
        questionBox.innerHTML = room.currentQuestion.question;
        
        if (room.buzzer && room.buzzer.pressedBy) {
            buzzerButton.disabled = true;
            const buzzerPlayerName = room.players[room.buzzer.pressedBy].name;
            gameStatus.textContent = `${buzzerPlayerName}が回答中...`;
            if (room.buzzer.pressedBy === currentPlayerId) {
                answerForm.classList.remove('hidden');
                answerInput.focus();
            }
        }
    }

    // 結果画面の更新
    if (room.gameState === 'finished') {
        resultMessage.textContent = room.winner === 'draw' ? '引き分け！' : `${room.players[room.winner].name}の勝利！`;
        finalScoreboard.innerHTML = '';
        Object.values(room.players).forEach(player => {
            const scoreDiv = document.createElement('div');
            scoreDiv.innerHTML = `${player.name}: ${player.score}点 / ${player.misses}ミス`;
            finalScoreboard.appendChild(scoreDiv);
        });
        newGameButton.classList.toggle('hidden', currentPlayerId !== 'player1');
    }
}

// --- スコアボードの更新 ---
function updateScoreboard(players) {
    ['player1', 'player2'].forEach(id => {
        const scoreBox = scoreboard[id];
        const player = players[id];
        if (player) {
            scoreBox.innerHTML = `
                <div class="name">${player.name}</div>
                <div class="score">${player.score} 点</div>
                <div class="misses">${'x'.repeat(player.misses)}</div>
            `;
            scoreBox.classList.remove('highlight');
        } else {
            scoreBox.innerHTML = '待機中...';
        }
    });
}

// --- ゲーム開始 ---
async function handleStartGame() {
    const newQuiz = await generateQuiz();
    roomRef.update({
        gameState: 'playing',
        currentQuestion: newQuiz,
        buzzer: null,
    });
}

// --- 早押し処理 ---
function handleBuzzerPress() {
    const buzzerRef = roomRef.child('buzzer');
    buzzerRef.transaction(currentBuzzer => {
        if (currentBuzzer === null) {
            return { pressedBy: currentPlayerId, timestamp: firebase.database.ServerValue.TIMESTAMP };
        }
        return; // 他の人が先に押したので何もしない
    }).catch(error => {
        console.error("Buzzer transaction failed: ", error);
    });
}

// --- 回答処理 ---
async function handleAnswerSubmit(e) {
    e.preventDefault();
    const submittedAnswer = answerInput.value.trim();
    if (!submittedAnswer) return;

    answerInput.value = '';

    const roomSnapshot = await roomRef.once('value');
    const room = roomSnapshot.val();
    const correctAnswer = room.currentQuestion.answer;

    let updates = {};
    let isCorrect = submittedAnswer.toLowerCase() === correctAnswer.toLowerCase();

    const currentPlayerState = room.players[currentPlayerId];
    
    if (isCorrect) {
        const newScore = currentPlayerState.score + 1;
        updates[`/players/${currentPlayerId}/score`] = newScore;
        
        if (newScore >= WIN_SCORE) {
            updates['/gameState'] = 'finished';
            updates['/winner'] = currentPlayerId;
        } else {
            // 次の問題へ
            const newQuiz = await generateQuiz();
            updates['/currentQuestion'] = newQuiz;
            updates['/buzzer'] = null;
        }
    } else {
        const newMisses = currentPlayerState.misses + 1;
        updates[`/players/${currentPlayerId}/misses`] = newMisses;

        if (newMisses >= LOSE_MISSES) {
            updates['/gameState'] = 'finished';
            const opponentId = currentPlayerId === 'player1' ? 'player2' : 'player1';
            updates['/winner'] = opponentId;
        } else {
            // ゲーム再開
            updates['/buzzer'] = null;
        }
    }

    await roomRef.update(updates);
}

// --- 新しいゲームを始める ---
function handleNewGame() {
    // スコアとミスをリセットして待機画面に戻る
    const updates = {
        'gameState': 'waiting',
        'players/player1/score': 0,
        'players/player1/misses': 0,
        'players/player2/score': 0,
        'players/player2/misses': 0,
        'currentQuestion': null,
        'buzzer': null,
        'winner': null
    };
    roomRef.update(updates);
}

// --- イベントリスナーの設定 ---
joinRoomButton.addEventListener('click', handleJoinRoom);
startGameButton.addEventListener('click', handleStartGame);
buzzerButton.addEventListener('click', handleBuzzerPress);
answerForm.addEventListener('submit', handleAnswerSubmit);
newGameButton.addEventListener('click', handleNewGame);
goToLoginButton.addEventListener('click', () => location.reload());

// --- 初期画面表示 ---
showScreen('login');
