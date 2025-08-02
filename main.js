
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
const auth = firebase.auth(); // ▼▼▼ 変更点：Authサービスを取得 ▼▼▼

// --- DOM要素の取得 (変更なし) ---
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
// ... (他のDOM要素は変更なし)
const waitingRoomName = document.getElementById('waiting-room-name');
const waitingPlayerList = document.getElementById('waiting-player-list');
const waitingMessage = document.getElementById('waiting-message');
const startGameButton = document.getElementById('start-game-button');
const waitingPlayerCount = document.querySelector('#waiting-screen p');
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
let currentPlayerId = null; // player1のようなIDではなく、FirebaseのUIDが入ります
let roomRef = null;
let roomListener = null;
let questionIntervalId = null;
let isHost = false;

const MAX_PLAYERS = 4;
const WIN_SCORE = 7;
const LOSE_MISSES = 3;

// --- 画面遷移 (変更なし) ---
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- クイズの山札を作成 (変更なし) ---
function createShuffledDeck() {
    if (!window.quizData || window.quizData.length === 0) return [];
    const indices = Array.from(Array(window.quizData.length).keys());
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}

// ▼▼▼ 変更点：Firebase Authを利用したルーム参加処理に全面修正 ▼▼▼
async function handleJoinRoom() {
    // --- デバッグ開始 ---
    console.log("handleJoinRoom 関数が開始されました。");
    alert("デバッグモード: ルーム参加処理を開始します。");

    const roomName = roomNameInput.value.trim();
    const password = passwordInput.value;
    const playerName = playerNameInput.value.trim();

    if (!roomName || !playerName) {
        loginError.textContent = 'ルーム名とあなたの名前を入力してください。';
        console.error("入力チェックエラー: ルーム名またはプレイヤー名が空です。");
        return;
    }

    loginError.textContent = '';
    joinRoomButton.disabled = true;

    try {
        // 1. 匿名認証
        console.log("ステップ1: 匿名認証を開始します...");
        const userCredential = await auth.signInAnonymously();
        currentPlayerId = userCredential.user.uid;
        
        // ★★★ 認証成功の確認 ★★★
        console.log("%cステップ1: 匿名認証に成功しました！", "color: green; font-weight: bold;");
        console.log("取得したUID:", currentPlayerId);
        alert(`認証成功！ あなたのID: ${currentPlayerId}`);
        
        // 2. データベース参照の定義
        console.log(`ステップ2: データベースのパス '/rooms/${roomName}' への参照を定義します。`);
        currentRoomName = roomName;
        roomRef = db.ref(`rooms/${currentRoomName}`);

        // 3. トランザクション処理
        console.log("ステップ3: データベースへの書き込み（トランザクション）を開始します...");
        alert("データベースへの書き込みを試みます。");

        const { committed, snapshot } = await roomRef.transaction(room => {
            console.log("トランザクション関数が実行されました。現在のルームデータ:", room);
            // (この中のロジックは変更なし)
            if (room === null) {
                isHost = true; return { password: password, players: { [currentPlayerId]: { name: playerName, score: 0, misses: 0, host: true }, }, gameState: 'waiting', hostId: currentPlayerId };
            }
            if (room.password && room.password !== password) { return; }
            if (Object.keys(room.players || {}).length >= MAX_PLAYERS) { return; }
            isHost = false; if (!room.players) room.players = {}; room.players[currentPlayerId] = { name: playerName, score: 0, misses: 0, host: false }; return room;
        });
        
        if (committed) {
             console.log("%cステップ3: データベースへの書き込みに成功しました！", "color: green; font-weight: bold;");
             alert("書き込み成功！待機画面に遷移します。");
        } else {
             console.error("%cステップ3: 書き込みがコミットされませんでした（中断）。", "color: orange; font-weight: bold;");
             alert("書き込みが中断されました。満員またはパスワード違いの可能性があります。");
        }

        if (!committed) {
            const roomData = (await roomRef.once('value')).val();
            if (roomData && roomData.password && roomData.password !== password) { loginError.textContent = 'パスワードが違います。'; }
            else { loginError.textContent = 'このルームは満員です。'; }
            await auth.signOut();
            return;
        }
        
        console.log("ルーム参加処理が正常に完了しました。リスナーを設定します。");
        setupRoomListener();

    } catch (error) {
        // ★★★ エラー発生時の詳細表示 ★★★
        console.error("%cルーム参加処理中に致命的なエラーが発生しました！", "color: red; font-size: 16px; font-weight: bold;");
        console.error("エラーオブジェクトの詳細はこちら:", error);
        alert(`致命的なエラーが発生しました。\nエラーコード: ${error.code}\nメッセージ: ${error.message}\n\nブラウザの開発者ツール（F12キー）のコンソールで詳細を確認してください。`);
        
        loginError.textContent = 'エラーが発生しました。再度お試しください。';
    } finally {
        console.log("finallyブロック: ボタンの無効化を解除します。");
        joinRoomButton.disabled = false;
    }
}
// ▲▲▲ 変更ここまで ▲▲▲

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
        // ▼▼▼ 変更点：自分のIDがルームに存在しない場合の処理を追加 ▼▼▼
        if (!room.players || !room.players[currentPlayerId]) {
            if (screens.login.classList.contains('active')) return; // ログイン画面なら何もしない
            alert('ルームから退出しました。');
            location.reload();
            return;
        }
        updateUI(room);
    });

    // ▼▼▼ 変更点：プレイヤーIDがFirebaseのUIDになったため、正しく動作する ▼▼▼
    const playerRef = roomRef.child(`players/${currentPlayerId}`);
    playerRef.onDisconnect().remove();
}

// --- UIの更新 ---
function updateUI(room) {
    if (questionIntervalId) {
        clearInterval(questionIntervalId);
        questionIntervalId = null;
    }

    // gameStateに基づいて画面を切り替え
    switch(room.gameState) {
        case 'playing': showScreen('game'); break;
        case 'finished': showScreen('result'); break;
        case 'waiting': default: showScreen('waiting'); break;
    }
    
    const players = room.players || {};
    const playerCount = Object.keys(players).length;
    // ▼▼▼ 変更点：ホスト判定をより確実な方法に変更 ▼▼▼
    isHost = room.hostId === currentPlayerId;

    // 待機画面の更新
    waitingRoomName.textContent = `ルーム名: ${currentRoomName}`;
    waitingPlayerCount.textContent = `プレイヤー情報（${playerCount}/${MAX_PLAYERS}人）`;
    waitingPlayerList.innerHTML = '';
    Object.values(players).forEach(p => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = `・${p.name} ${p.host ? '(ホスト)' : ''}`;
        waitingPlayerList.appendChild(playerDiv);
    });

    // ▼▼▼ 変更点：ホストと参加者でメッセージを分ける ▼▼▼
    if (isHost) {
        if (playerCount > 1) {
            waitingMessage.textContent = 'メンバーが揃いました。ゲームを開始してください。';
            startGameButton.classList.remove('hidden');
        } else {
            waitingMessage.textContent = '他のプレイヤーの参加を待っています...';
            startGameButton.classList.add('hidden');
        }
    } else {
        waitingMessage.textContent = 'ホストがゲームを開始するのを待っています...';
        startGameButton.classList.add('hidden');
    }

    // 対戦画面の更新
    updateScoreboard(players);
    buzzerButton.disabled = false;
    answerForm.classList.add('hidden');
    answerInput.value = '';

    let statusText = room.gameStatusText || '';
    if (!statusText && room.buzzer?.pressedBy) {
        const buzzerPlayerName = players[room.buzzer.pressedBy]?.name || '誰か';
        statusText = `${buzzerPlayerName}が回答中...`;
    }
    gameStatus.textContent = statusText;
    
    if (room.gameState === 'playing' && room.currentQuestion) {
        const fullQuestion = room.currentQuestion.question;
        if (room.buzzer?.pressedBy || room.gameStatusText) {
            buzzerButton.disabled = true;
            questionBox.textContent = fullQuestion;
            if (room.buzzer?.pressedBy === currentPlayerId) {
                answerForm.classList.remove('hidden');
                answerInput.focus();
            }
        } else {
            questionBox.textContent = '';
            let charIndex = 0;
            questionIntervalId = setInterval(() => {
                if (charIndex < fullQuestion.length) {
                    questionBox.textContent += fullQuestion[charIndex];
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

    // 結果画面の更新
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

// --- スコアボードの更新 (変更なし) ---
function updateScoreboard(players) {
    scoreboardContainer.innerHTML = '';
    const playerIds = Object.keys(players).sort();
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

// (以下のゲームロジック部分は変更の必要がないため、そのままです)
// --- ゲーム開始 ---
async function handleStartGame() {
    // ... (変更なし)
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
            gameStatusText: ''
        });
    } catch (error) {
        console.error("ゲーム開始エラー:", error);
    }
}
// --- 正解エフェクト表示 ---
function showCorrectEffect() {
    // ... (変更なし)
    correctPopup.classList.add('show');
    setTimeout(() => {
        correctPopup.classList.remove('show');
    }, 1000);
}
// --- 早押し処理 ---
function handleBuzzerPress() {
    // ... (変更なし)
    roomRef.child('buzzer').transaction(currentBuzzer => {
        return currentBuzzer === null ? { pressedBy: currentPlayerId } : undefined;
    }, async (error, committed, snapshot) => {
        if (error) { console.error("Buzzer press error:", error); }
        if (!committed) { console.log("Buzzer already pressed."); }
    });
}
// --- 回答処理 ---
async function handleAnswerSubmit(e) {
    // ... (変更なし)
    e.preventDefault();
    const submittedAnswer = answerInput.value.trim();
    if (!submittedAnswer) return;

    answerForm.classList.add('hidden');
    answerInput.value = '';

    const snapshot = await roomRef.once('value');
    const room = snapshot.val();
    if (!room?.currentQuestion || !room.players[currentPlayerId]) return;

    const correctAnswer = room.currentQuestion.answer;
    const answerPlayerName = room.players[currentPlayerId].name;
    
    await roomRef.update({ gameStatusText: `${answerPlayerName}の答え: ${submittedAnswer}` });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const isCorrect = submittedAnswer.toLowerCase() === correctAnswer.toLowerCase();
    const updates = {};

    if (isCorrect) {
        showCorrectEffect();
        await roomRef.update({ gameStatusText: "正解！" });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const newScore = (room.players[currentPlayerId].score || 0) + 1;
        updates[`/players/${currentPlayerId}/score`] = newScore;
        
        if (newScore >= WIN_SCORE) {
            updates['/gameState'] = 'finished';
            updates['/winner'] = currentPlayerId;
            updates['/gameStatusText'] = `${answerPlayerName}の勝利！`;
            await roomRef.update(updates);
            return;
        }
    } else {
        await roomRef.update({ gameStatusText: `不正解！ 正解は... ${correctAnswer}` });
        await new Promise(resolve => setTimeout(resolve, 2500));

        const newMisses = (room.players[currentPlayerId].misses || 0) + 1;
        updates[`/players/${currentPlayerId}/misses`] = newMisses;

        if (newMisses >= LOSE_MISSES) {
            updates['/gameState'] = 'finished';
            let winnerId = 'draw';
            let maxScore = -1;
            Object.entries(room.players).forEach(([id, player]) => {
                if (id !== currentPlayerId) {
                    if ((player.score || 0) > maxScore) {
                        maxScore = player.score;
                        winnerId = id;
                    } else if ((player.score || 0) === maxScore) {
                        winnerId = 'draw';
                    }
                }
            });
            updates['/winner'] = winnerId;
            updates['/gameStatusText'] = 'ゲーム終了！';
            await roomRef.update(updates);
            return;
        }
    }
    
    for (let i = 5; i > 0; i--) {
        await roomRef.update({ gameStatusText: `次の問題まで ${i} 秒` });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    let remainingDeck = room.questionDeck || [];
    if (remainingDeck.length === 0) {
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
        const nextQuestionIndex = remainingDeck.shift();
        updates['/currentQuestion'] = window.quizData[nextQuestionIndex];
        updates['/questionDeck'] = remainingDeck;
    }
    
    updates['/buzzer'] = null;
    updates['/gameStatusText'] = '';
    
    await roomRef.update(updates);
}
// --- 新しいゲームを始める ---
async function handleNewGame() {
    // ... (変更なし)
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
    // ページをリロードするだけでonDisconnectが発動し、安全に退出できる
    location.reload();
});

// --- 初期画面表示 ---
showScreen('login');
