// main.js

// ▼▼▼ あなたのFirebase設定情報をここに貼り付け ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyCwRAgSfOOPpOrEH7wJdCmLHtOgJOb2ZKg",
  authDomain: "quiz-app-ab0b2.firebaseapp.com",
  databaseURL: "https://quiz-app-ab0b2-default-rtdb.firebaseio.com",
  projectId: "quiz-app-ab0b2",
  storageBucket: "quiz-app-ab0b2.firebasestorage.app",
  messagingSenderId: "825831547139",
  appId: "1:825831547139:web:e49f693e37afa444b18936",
  measurementId: "G-RYX5Z4YHDC"
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
const waitingPlayerCount = document.querySelector('#waiting-screen p'); // プレイヤー人数表示用

const scoreboardContainer = document.getElementById('scoreboard');
const questionBox = document.getElementById('question-box');
const gameStatus = document.getElementById('game-status');
const buzzerButton = document.getElementById('buzzer-button');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');

const resultMessage = document.getElementById('result-message');
const finalScoreboard = document.getElementById('final-scoreboard');
const newGameButton = document.getElementById('new-game-button');
const goToLoginButton = document.getElementById('go-to-login-button');
const correctPopup = document.getElementById('correct-popup');

// --- グローバル変数 ---
let currentRoomName = null;
let currentPlayerId = null;
let roomRef = null;
let roomListener = null;
let questionIntervalId = null;
let isHost = false;

const MAX_PLAYERS = 4;
const WIN_SCORE = 7;
const LOSE_MISSES = 3;

// --- 画面遷移 ---
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- クイズの山札を作成 ---
function createShuffledDeck() {
    if (!window.quizData || window.quizData.length === 0) return [];
    const indices = Array.from(Array(window.quizData.length).keys());
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}

// --- ルームへの参加/作成処理 ---
async function handleJoinRoom() {
    const roomName = roomNameInput.value.trim();
    const password = passwordInput.value;
    const playerName = playerNameInput.value.trim();

    if (!roomName || !playerName) {
        loginError.textContent = 'ルーム名とあなたの名前を入力してください。';
        return;
    }

    loginError.textContent = '';
    currentRoomName = roomName;
    roomRef = db.ref(`rooms/${currentRoomName}`);

    try {
        const snapshot = await roomRef.once('value');
        const room = snapshot.val();

        if (!room) { // 新規ルーム作成
            isHost = true;
            currentPlayerId = `player1`;
            const newRoomData = {
                password: password,
                players: {
                    [currentPlayerId]: { name: playerName, score: 0, misses: 0, isReady: true, host: true },
                },
                gameState: 'waiting',
                hostId: currentPlayerId
            };
            await roomRef.set(newRoomData);
        } else { // 既存ルームに参加
            if (room.password && room.password !== password) {
                loginError.textContent = 'パスワードが違います。';
                return;
            }
            const playerCount = Object.keys(room.players || {}).length;
            if (playerCount >= MAX_PLAYERS && room.gameState !== 'waiting') {
                loginError.textContent = 'このルームは満員か、既にゲームが始まっています。';
                return;
            }

            let nextPlayerNum = 1;
            while(room.players[`player${nextPlayerNum}`]) {
                nextPlayerNum++;
            }
            currentPlayerId = `player${nextPlayerNum}`;
            
            await roomRef.child(`players/${currentPlayerId}`).set({ name: playerName, score: 0, misses: 0, isReady: true });
        }
        setupRoomListener();
    } catch (error) {
        console.error("ルーム参加処理エラー:", error);
        loginError.textContent = 'エラーが発生しました。';
    }
}

// --- ルームの状態を監視 ---
function setupRoomListener() {
    if (roomListener) roomRef.off('value', roomListener);
    
    roomListener = roomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (!room) {
            if (questionIntervalId) clearInterval(questionIntervalId);
            alert('ルームが削除されました。');
            location.reload();
            return;
        }
        updateUI(room);
    });

    const playerRef = roomRef.child(`players/${currentPlayerId}`);
    playerRef.onDisconnect().remove();
}

// --- UIの更新 ---
function updateUI(room) {
    if (questionIntervalId) {
        clearInterval(questionIntervalId);
        questionIntervalId = null;
    }

    if (room.gameState === 'finished') {
        showScreen('result');
    } else if (room.gameState === 'playing') {
        showScreen('game');
    } else {
        showScreen('waiting');
    }
    
    // 待機画面
    const players = room.players || {};
    const playerCount = Object.keys(players).length;
    isHost = players[currentPlayerId]?.host || false;

    waitingRoomName.textContent = `ルーム名: ${currentRoomName}`;
    waitingPlayerCount.textContent = `プレイヤー情報（${playerCount}/${MAX_PLAYERS}人）`;
    waitingPlayerList.innerHTML = '';
    Object.values(players).forEach(p => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = `・${p.name} ${p.host ? '(ホスト)' : ''}`;
        waitingPlayerList.appendChild(playerDiv);
    });

    if (playerCount > 1) {
        waitingMessage.textContent = '全員揃いました！';
        startGameButton.classList.toggle('hidden', !isHost);
    } else {
        waitingMessage.textContent = '他のプレイヤーの参加を待っています...';
        startGameButton.classList.add('hidden');
    }

    // 対戦画面
    updateScoreboard(players);
    buzzerButton.disabled = false;
    answerForm.classList.add('hidden');
    answerInput.value = '';
    gameStatus.textContent = '';
    
    if (room.gameState === 'playing' && room.currentQuestion) {
        const fullQuestion = room.currentQuestion.question;
        if (room.buzzer?.pressedBy) {
            buzzerButton.disabled = true;
            questionBox.innerHTML = fullQuestion;
            const buzzerPlayerName = players[room.buzzer.pressedBy]?.name || '誰か';
            gameStatus.textContent = `${buzzerPlayerName}が回答中...`;
            if (room.buzzer.pressedBy === currentPlayerId) {
                answerForm.classList.remove('hidden');
                answerInput.focus();
            }
        } else {
            questionBox.innerHTML = '';
            let charIndex = 0;
            questionIntervalId = setInterval(() => {
                if (charIndex < fullQuestion.length) {
                    questionBox.innerHTML += fullQuestion[charIndex];
                    charIndex++;
                } else {
                    clearInterval(questionIntervalId);
                    questionIntervalId = null;
                }
            }, 100);
        }
    } else {
        questionBox.innerHTML = '';
    }

    // 結果画面
    if (room.gameState === 'finished') {
        resultMessage.textContent = room.winner === 'draw' ? '引き分け！' : `${players[room.winner]?.name || ''}の勝利！`;
        finalScoreboard.innerHTML = '';
        Object.values(players).forEach(player => {
            const scoreDiv = document.createElement('div');
            scoreDiv.innerHTML = `${player.name}: ${player.score}点 / ${player.misses}ミス`;
            finalScoreboard.appendChild(scoreDiv);
        });
        newGameButton.classList.toggle('hidden', !isHost);
    }
}

// --- スコアボードの更新 ---
function updateScoreboard(players) {
    scoreboardContainer.innerHTML = '';
    const playerIds = Object.keys(players).sort(); // player1, player2...の順に
    playerIds.forEach(id => {
        const player = players[id];
        const scoreBox = document.createElement('div');
        scoreBox.id = `${id}-score`;
        scoreBox.className = 'player-score-box';
        scoreBox.innerHTML = `
            <div class="name">${player.name}</div>
            <div class="score">${player.score || 0} 点</div>
            <div class="misses">${'x'.repeat(player.misses || 0)}</div>
        `;
        scoreboardContainer.appendChild(scoreBox);
    });
}

// --- ゲーム開始 ---
async function handleStartGame() {
    try {
        const shuffledDeck = createShuffledDeck();
        if (shuffledDeck.length === 0) {
            alert("クイズの準備ができていません。");
            return;
        }
        const firstQuestionIndex = shuffledDeck.shift();
        const firstQuestion = window.quizData[firstQuestionIndex];

        await roomRef.update({
            gameState: 'playing',
            currentQuestion: firstQuestion,
            questionDeck: shuffledDeck,
            buzzer: null,
        });
    } catch (error) {
        console.error("ゲーム開始エラー:", error);
    }
}

// --- 正解エフェクト表示 ---
function showCorrectEffect() {
    correctPopup.classList.add('show');
    setTimeout(() => {
        correctPopup.classList.remove('show');
    }, 1000); // 1秒後に非表示
}

// --- 早押し処理 ---
function handleBuzzerPress() {
    roomRef.child('buzzer').transaction(currentBuzzer => {
        return currentBuzzer === null ? { pressedBy: currentPlayerId } : undefined;
    });
}

// --- 回答処理（再修正版） ---
async function handleAnswerSubmit(e) {
    e.preventDefault();
    const submittedAnswer = answerInput.value.trim();
    if (!submittedAnswer) return;

    // 自分の回答フォームはすぐに非表示に
    answerForm.classList.add('hidden');
    answerInput.value = '';

    // データベースに回答内容を書き込み、全プレイヤーで共有する
    await roomRef.child('buzzer/submittedAnswer').set(submittedAnswer);

    const snapshot = await roomRef.once('value');
    const room = snapshot.val();
    if (!room?.currentQuestion) return;

    const correctAnswer = room.currentQuestion.answer;
    const isCorrect = submittedAnswer.toLowerCase() === correctAnswer.toLowerCase();
    const currentPlayerState = room.players[currentPlayerId];
    const updates = {};
    
    // 回答者名と提出された答えを全員に表示
    const answerPlayerName = currentPlayerState.name || '誰か';
    gameStatus.textContent = `${answerPlayerName}の答え: ${submittedAnswer}`;
    await new Promise(resolve => setTimeout(resolve, 2000)); // 答えを見せるための時間

    // 正解・不正解の判定
    if (isCorrect) {
        // --- 正解だった場合の処理 ---
        showCorrectEffect(); // ★ 正解エフェクトを呼び出す
        gameStatus.textContent = "正解！";
        await new Promise(resolve => setTimeout(resolve, 1000)); // エフェクトを見せる時間

        const newScore = (currentPlayerState.score || 0) + 1;
        updates[`/players/${currentPlayerId}/score`] = newScore;
        
        if (newScore >= WIN_SCORE) {
            updates['/gameState'] = 'finished';
            updates['/winner'] = currentPlayerId;
            await roomRef.update(updates);
            return;
        }
    } else {
        // --- 誤答だった場合の処理 ---
        gameStatus.textContent = `不正解！ 正解は... ${correctAnswer}`;
        await new Promise(resolve => setTimeout(resolve, 2000)); // 正解を見せる時間

        const newMisses = (currentPlayerState.misses || 0) + 1;
        updates[`/players/${currentPlayerId}/misses`] = newMisses;

        if (newMisses >= LOSE_MISSES) {
            updates['/gameState'] = 'finished';
            let winnerId = '';
            let maxScore = -1;
            Object.entries(room.players).forEach(([id, player]) => {
                if (id !== currentPlayerId && (player.score || 0) > maxScore) {
                    maxScore = player.score;
                    winnerId = id;
                }
            });
            updates['/winner'] = winnerId || 'draw';
            await roomRef.update(updates);
            return;
        }
    }
    
    // --- 次の問題に進む共通処理 ---
    let remainingDeck = room.questionDeck || [];
    if (remainingDeck.length === 0) {
        updates['/gameState'] = 'finished';
        let winnerId = '';
        let maxScore = -1;
        let isDraw = false;
        Object.entries(room.players).forEach(([id, player]) => {
            const score = player.score || 0;
            if (score > maxScore) {
                maxScore = score;
                winnerId = id;
                isDraw = false;
            } else if (score === maxScore) {
                isDraw = true;
            }
        });
        updates['/winner'] = isDraw ? 'draw' : winnerId;
    } else {
        const nextQuestionIndex = remainingDeck.shift();
        updates['/currentQuestion'] = window.quizData[nextQuestionIndex];
        updates['/questionDeck'] = remainingDeck;
        updates['/buzzer'] = null;
    }
    
    await roomRef.update(updates);
}

// --- 新しいゲームを始める ---
async function handleNewGame() {
    const snapshot = await roomRef.once('value');
    const room = snapshot.val();
    const updates = {
        'gameState': 'waiting',
        'currentQuestion': null,
        'buzzer': null,
        'winner': null,
        'questionDeck': null
    };
    // 各プレイヤーのスコアとミスをリセット
    Object.keys(room.players).forEach(playerId => {
        updates[`/players/${playerId}/score`] = 0;
        updates[`/players/${playerId}/misses`] = 0;
    });
    roomRef.update(updates);
}

// --- イベントリスナーの設定 ---
joinRoomButton.addEventListener('click', handleJoinRoom);
startGameButton.addEventListener('click', handleStartGame);
buzzerButton.addEventListener('click', handleBuzzerPress);
answerForm.addEventListener('submit', handleAnswerSubmit);
newGameButton.addEventListener('click', handleNewGame);
goToLoginButton.addEventListener('click', () => {
    if (roomRef && currentPlayerId) {
        roomRef.child(`players/${currentPlayerId}`).remove();
    }
    location.reload();
});

// --- 初期画面表示 ---
showScreen('login');
