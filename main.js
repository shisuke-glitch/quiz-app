
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

// --- UIの更新 (修正済み) ---
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

    // ★★★ 修正箇所 ★★★
    // gameStatusの表示ロジックをDBと同期するように変更
    let statusText = room.gameStatusText || ''; // DBからのテキストを優先
    if (!statusText && room.buzzer?.pressedBy) {
        const buzzerPlayerName = players[room.buzzer.pressedBy]?.name || '誰か';
        statusText = `${buzzerPlayerName}が回答中...`;
    }
    gameStatus.textContent = statusText;
    
    if (room.gameState === 'playing' && room.currentQuestion) {
        const fullQuestion = room.currentQuestion.question;
        // 回答中は問題文を全文表示し、問題表示のアニメーションを止める
        if (room.buzzer?.pressedBy || room.gameStatusText) {
            buzzerButton.disabled = true;
            questionBox.innerHTML = fullQuestion;
            if (room.buzzer?.pressedBy === currentPlayerId) {
                answerForm.classList.remove('hidden');
                answerInput.focus();
            }
        } else {
            // 問題文を1文字ずつ表示
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
            <div class="misses">${'x'.repeat(Math.max(0, Math.min(Number.isInteger(player.misses) ? player.misses : 0, 10)))}</div>
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
            gameStatusText: '' // ゲームステータス表示をリセット
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
        // gameStatusTextが設定されている間（判定中やカウントダウン中）はブザーを押せないようにする
        // ※このトランザクションはブザーの状態のみを見るため、別途gameStatusTextのチェックが必要
        return currentBuzzer === null ? { pressedBy: currentPlayerId } : undefined;
    }, async (error, committed, snapshot) => {
        if (error) {
            console.error("Buzzer press error:", error);
        }
        if (!committed) {
            // トランザクションが失敗した場合（ほぼ同時に押された場合など）
            console.log("Buzzer already pressed.");
        }
    });
}


// --- 回答処理 (★★機能追加・全体修正★★) ---
async function handleAnswerSubmit(e) {
    e.preventDefault();
    const submittedAnswer = answerInput.value.trim();
    if (!submittedAnswer) return;

    answerForm.classList.add('hidden');
    answerInput.value = '';

    // 最新のルーム情報を取得
    const snapshot = await roomRef.once('value');
    const room = snapshot.val();
    if (!room?.currentQuestion || !room.players[currentPlayerId]) return;

    const correctAnswer = room.currentQuestion.answer;
    const answerPlayerName = room.players[currentPlayerId].name;
    
    // 1. 回答を全員で共有
    await roomRef.update({ gameStatusText: `${answerPlayerName}の答え: ${submittedAnswer}` });
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒間、回答を表示

    // 2. 正誤判定と比較結果を共有
    const isCorrect = submittedAnswer.toLowerCase() === correctAnswer.toLowerCase();
    const updates = {};

    if (isCorrect) {
        // --- 正解だった場合の処理 ---
        showCorrectEffect(); // 回答者自身の画面にエフェクト表示
        await roomRef.update({ gameStatusText: "正解！" });
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5秒間、「正解！」を表示

        const newScore = (room.players[currentPlayerId].score || 0) + 1;
        updates[`/players/${currentPlayerId}/score`] = newScore;
        
        if (newScore >= WIN_SCORE) {
            updates['/gameState'] = 'finished';
            updates['/winner'] = currentPlayerId;
            updates['/gameStatusText'] = `${answerPlayerName}の勝利！`;
            await roomRef.update(updates);
            return; // 処理を終了
        }

    } else {
        // --- 誤答だった場合の処理 ---
        await roomRef.update({ gameStatusText: `不正解！ 正解は... ${correctAnswer}` });
        await new Promise(resolve => setTimeout(resolve, 2500)); // 2.5秒間、正解を表示

        const newMisses = (room.players[currentPlayerId].misses || 0) + 1;
        updates[`/players/${currentPlayerId}/misses`] = newMisses;

        if (newMisses >= LOSE_MISSES) {
            updates['/gameState'] = 'finished';
            // 敗者以外の最高得点者を勝者とする
            let winnerId = 'draw';
            let maxScore = -1;
            Object.entries(room.players).forEach(([id, player]) => {
                if (id !== currentPlayerId) {
                    if ((player.score || 0) > maxScore) {
                        maxScore = player.score;
                        winnerId = id;
                    } else if ((player.score || 0) === maxScore) {
                        winnerId = 'draw'; // 最高得点が複数いる場合は引き分け
                    }
                }
            });
            updates['/winner'] = winnerId;
            updates['/gameStatusText'] = 'ゲーム終了！';
            await roomRef.update(updates);
            return; // 処理を終了
        }
    }
    
    // 3. 次の問題へのカウントダウンを共有
    for (let i = 5; i > 0; i--) {
        await roomRef.update({ gameStatusText: `次の問題まで ${i} 秒` });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. 次の問題に進む
    let remainingDeck = room.questionDeck || [];
    if (remainingDeck.length === 0) {
        // 山札が尽きた場合
        updates['/gameState'] = 'finished';
        let winnerId = 'draw';
        let maxScore = -1;
        Object.entries(room.players).forEach(([id, player]) => {
            const score = player.score || 0;
            if (score > maxScore) {
                maxScore = score;
                winnerId = id;
            } else if (score === maxScore) {
                winnerId = 'draw';
            }
        });
        updates['/winner'] = winnerId;
    } else {
        // 次の問題をセット
        const nextQuestionIndex = remainingDeck.shift();
        updates['/currentQuestion'] = window.quizData[nextQuestionIndex];
        updates['/questionDeck'] = remainingDeck;
    }
    
    // 状態をリセットして次の問題へ
    updates['/buzzer'] = null;
    updates['/gameStatusText'] = ''; // ステータス表示をクリア
    
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
        'questionDeck': null,
        'gameStatusText': ''
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
