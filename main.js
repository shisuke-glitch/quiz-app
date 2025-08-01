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
let questionIntervalId = null;

const WIN_SCORE = 7;
const LOSE_MISSES = 3;

// --- 画面遷移 ---
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- クイズの山札を作成する関数 ---
function createShuffledDeck() {
    if (!window.quizData || window.quizData.length === 0) {
        console.error('クイズデータが読み込まれていません。');
        return [];
    }
    // 全問題のインデックス番号の配列を作成 (例: [0, 1, 2, ...])
    const indices = Array.from(Array(window.quizData.length).keys());
    
    // フィッシャー–イェーツのシャッフルアルゴリズムで配列をシャッフル
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

    if (!roomName || !password || !playerName) {
        loginError.textContent = 'すべての項目を入力してください。';
        return;
    }

    loginError.textContent = '';
    currentRoomName = roomName;
    roomRef = db.ref(`rooms/${currentRoomName}`);

    try {
        const snapshot = await roomRef.once('value');
        const room = snapshot.val();

        if (!room) {
            currentPlayerId = 'player1';
            const newRoomData = {
                password: password,
                players: {
                    player1: { name: playerName, score: 0, misses: 0, isReady: true },
                },
                gameState: 'waiting',
            };
            await roomRef.set(newRoomData);
        } else {
            if (room.password !== password) {
                loginError.textContent = 'パスワードが違います。';
                return;
            }
            if (room.players && room.players.player2 && room.players.player2.isReady) {
                loginError.textContent = 'このルームは満員です。';
                return;
            }
            currentPlayerId = 'player2';
            await roomRef.child('players/player2').set({ name: playerName, score: 0, misses: 0, isReady: true });
        }
        setupRoomListener();
    } catch (error) {
        console.error("ルーム参加処理エラー:", error);
        loginError.textContent = 'エラーが発生しました。通信環境を確認してください。';
    }
}

// --- ルームの状態を監視 ---
function setupRoomListener() {
    if (roomListener) roomRef.off('value', roomListener);
    
    roomListener = roomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (!room) {
            if (questionIntervalId) clearInterval(questionIntervalId);
            alert('ルームが削除されました。トップページに戻ります。');
            location.reload();
            return;
        }
        updateUI(room);
    }, (error) => {
        console.error("データベース監視エラー:", error);
        alert("通信エラーが発生しました。ページをリロードしてください。");
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
    
    waitingRoomName.textContent = `ルーム名: ${currentRoomName}`;
    waitingPlayerList.innerHTML = '';
    if (room.players) {
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
    }

    updateScoreboard(room.players || {});
    buzzerButton.disabled = false;
    answerForm.classList.add('hidden');
    answerInput.value = '';
    gameStatus.textContent = '';
    
    if (room.gameState === 'playing' && room.currentQuestion) {
        const fullQuestion = room.currentQuestion.question;

        if (room.buzzer && room.buzzer.pressedBy) {
            buzzerButton.disabled = true;
            questionBox.innerHTML = fullQuestion;

            const buzzerPlayerName = room.players[room.buzzer.pressedBy]?.name || '誰か';
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

    if (room.gameState === 'finished' && room.players) {
        resultMessage.textContent = room.winner === 'draw' ? '引き分け！' : `${room.players[room.winner]?.name || ''}の勝利！`;
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
                <div class="misses">${'x'.repeat(player.misses || 0)}</div>
            `;
        } else {
            scoreBox.innerHTML = '待機中...';
        }
    });
}

// --- ゲーム開始 ---
async function handleStartGame() {
    try {
        const shuffledDeck = createShuffledDeck();
        if (shuffledDeck.length === 0) {
            alert("クイズの準備ができていません。ページをリロードしてください。");
            return;
        }

        const firstQuestionIndex = shuffledDeck.shift();
        const firstQuestion = window.quizData[firstQuestionIndex];

        await roomRef.update({
            gameState: 'playing',
            currentQuestion: firstQuestion,
            questionDeck: shuffledDeck, // 残りの山札をDBに保存
            buzzer: null,
        });
    } catch (error) {
        console.error("ゲーム開始エラー:", error);
        alert("ゲームの開始に失敗しました。");
    }
}

// --- 早押し処理 ---
function handleBuzzerPress() {
    const buzzerRef = roomRef.child('buzzer');
    buzzerRef.transaction(currentBuzzer => {
        if (currentBuzzer === null) {
            return { pressedBy: currentPlayerId, timestamp: firebase.database.ServerValue.TIMESTAMP };
        }
        return;
    }).catch(error => {
        console.error("Buzzer transaction failed: ", error);
    });
}

// --- 回答処理 ---
async function handleAnswerSubmit(e) {
    e.preventDefault();
    const submittedAnswer = answerInput.value.trim();
    if (!submittedAnswer) return;

    answerForm.classList.add('hidden');
    answerInput.value = '';

    const roomSnapshot = await roomRef.once('value');
    const room = roomSnapshot.val();
    if (!room || !room.currentQuestion) return;

    const correctAnswer = room.currentQuestion.answer;
    const updates = {};
    const isCorrect = submittedAnswer.toLowerCase() === correctAnswer.toLowerCase();
    const currentPlayerState = room.players[currentPlayerId];
    
    gameStatus.textContent = `正解は... ${correctAnswer}`;
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (isCorrect) {
        const newScore = (currentPlayerState.score || 0) + 1;
        updates[`/players/${currentPlayerId}/score`] = newScore;
        
        if (newScore >= WIN_SCORE) {
            updates['/gameState'] = 'finished';
            updates['/winner'] = currentPlayerId;
            await roomRef.update(updates);
            return;
        }
    } else {
        const newMisses = (currentPlayerState.misses || 0) + 1;
        updates[`/players/${currentPlayerId}/misses`] = newMisses;

        if (newMisses >= LOSE_MISSES) {
            updates['/gameState'] = 'finished';
            const opponentId = currentPlayerId === 'player1' ? 'player2' : 'player1';
            updates['/winner'] = opponentId;
            await roomRef.update(updates);
            return;
        }
    }
    
    // --- 次の問題に進む処理 ---
    let remainingDeck = room.questionDeck || [];
    if (remainingDeck.length === 0) {
        // 山札が尽きた場合、点数で勝敗を決定
        updates['/gameState'] = 'finished';
        const p1Score = room.players.player1.score || 0;
        const p2Score = room.players.player2.score || 0;
        if (p1Score > p2Score) {
            updates['/winner'] = 'player1';
        } else if (p2Score > p1Score) {
            updates['/winner'] = 'player2';
        } else {
            updates['/winner'] = 'draw';
        }
    } else {
        // 山札から次の問題を取得
        const nextQuestionIndex = remainingDeck.shift();
        const newQuiz = window.quizData[nextQuestionIndex];
        updates['/currentQuestion'] = newQuiz;
        updates['/questionDeck'] = remainingDeck;
        updates['/buzzer'] = null;
    }
    
    await roomRef.update(updates);
}

// --- 新しいゲームを始める ---
function handleNewGame() {
    // スコアとミスをリセットし、待機画面に戻す
    // ゲーム開始時に新しい山札が作られるので、ここではリセット不要
    const updates = {
        'gameState': 'waiting',
        'players/player1/score': 0,
        'players/player1/misses': 0,
        'players/player2/score': 0,
        'players/player2/misses': 0,
        'currentQuestion': null,
        'buzzer': null,
        'winner': null,
        'questionDeck': null
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
