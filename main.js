
// main.js

// ▼▼▼ Firebase v9の関数をインポート ▼▼▼
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, runTransaction, onValue, onDisconnect, get, set, update } from "firebase/database";

// あなたのFirebaseプロジェクトの設定情報
const firebaseConfig = {
  apiKey: "AIzaSyCwRAgSfOOPpOrEH7wJdCmLHtOgJOb2ZKg",// セキュリティのため実際のキーは記載しないでください
  authDomain: "quiz-app-ab0b2.firebaseapp.com",
  databaseURL: "https://quiz-app-ab0b2-default-rtdb.firebaseio.com",
  projectId: "quiz-app-ab0b2",
  storageBucket: "quiz-app-ab0b2.appspot.com",
  messagingSenderId: "825831547139",
  appId: "1:825831547139:web:e49f693e37afa444b18936",
  measurementId: "G-RYX5Z4YHDC"
};

// Firebaseを初期化します
const app = initializeApp(firebaseConfig);

// Firebaseの各サービスを利用可能にします
export const db = getDatabase(app);       // Realtime Database のインスタンスを取得
export const auth = getAuth(app);         // Firebase Authentication のインスタンスを取得
const analytics = getAnalytics(app);      // Google Analytics (任意)

// ▲▲▲ あなたのFirebase設定情報をここに貼り付け ▲▲▲

// ▼▼▼ Firebaseの初期化（v9形式） ▼▼▼
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- DOM要素の取得 (変更なし) ---
const screens = { /* ... */ }; // (この部分はあなたのコードのままでOK)
// (すべてのDOM要素取得コードをここに配置)
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
let currentPlayerId = null;
let roomRef = null;
let roomListener = null;
let questionIntervalId = null;
let isHost = false;
// (定数なども変更なし)
const MAX_PLAYERS = 4;
const WIN_SCORE = 7;
const LOSE_MISSES = 3;

// --- 画面遷移 (変更なし) ---
function showScreen(screenName) { /* ... */ } // (この部分はあなたのコードのままでOK)

// --- クイズの山札を作成 (変更なし) ---
function createShuffledDeck() { /* ... */ } // (この部分はあなたのコードのままでOK)

// ▼▼▼ v9形式に書き換えたルーム参加処理 ▼▼▼
async function handleJoinRoom() {
    const roomName = roomNameInput.value.trim();
    const password = passwordInput.value;
    const playerName = playerNameInput.value.trim();

    if (!roomName || !playerName) {
        loginError.textContent = 'ルーム名とあなたの名前を入力してください。';
        return;
    }

    loginError.textContent = '';
    joinRoomButton.disabled = true;

    try {
        // 1. 匿名認証 (v9形式)
        const userCredential = await signInAnonymously(auth);
        currentPlayerId = userCredential.user.uid;
        console.log("匿名認証成功！ UID:", currentPlayerId);

        // 2. データベース参照の定義 (v9形式)
        currentRoomName = roomName;
        roomRef = ref(db, `rooms/${currentRoomName}`);

        // ★★★ 修正点：playerCount を利用したトランザクション処理 ★★★
        const { committed, snapshot } = await runTransaction(roomRef, (room) => {
            // [最初のプレイヤーの場合]
            if (room === null) {
                isHost = true;
                // playerCountを1に設定してルームを作成
                return {
                    password: password,
                    playerCount: 1, // カウンターを1に設定
                    players: { [currentPlayerId]: { name: playerName, score: 0, misses: 0, host: true } },
                    gameState: 'waiting',
                    hostId: currentPlayerId
                };
            }

            // [2人目以降のプレイヤーの場合]
            if (room.password && room.password !== password) {
                // パスワードが違う場合は中断
                return; 
            }

            // playerCountを使って人数をチェック
            const currentCount = room.playerCount || 0;
            if (currentCount >= MAX_PLAYERS) {
                // 人数が満員の場合は中断
                return;
            }

            isHost = false;
            if (!room.players) {
                room.players = {};
            }
            
            // プレイヤーデータを追加し、カウンターを+1する
            room.players[currentPlayerId] = { name: playerName, score: 0, misses: 0, host: false };
            room.playerCount = currentCount + 1; // カウンターをインクリメント
            
            return room;
        });

        if (!committed) {
            // トランザクションが中断された場合
            const roomSnap = await get(roomRef); // v9形式で現在のデータを取得
            const roomData = roomSnap.val();
            if (roomData && roomData.password && roomData.password !== password) {
                loginError.textContent = 'パスワードが違います。';
            } else {
                loginError.textContent = 'このルームは満員です。';
            }
            await signOut(auth); // v9形式でサインアウト
            return;
        }
        
        // 参加成功
        console.log("ルーム参加処理が正常に完了しました。リスナーを設定します。");
        setupRoomListener();

    } catch (error) {
        console.error("ルーム参加処理エラー:", error);
        loginError.textContent = 'エラーが発生しました。再度お試しください。';
    } finally {
        joinRoomButton.disabled = false;
    }
}

// ▼▼▼ v9形式に書き換えたルーム状態監視 ▼▼▼
function setupRoomListener() {
    // 既存のリスナーがあれば解除（v9では関数をそのまま渡す）
    if (roomListener) roomListener(); 

    // onValueでリスナーを設定 (v9形式)
    roomListener = onValue(roomRef, (snapshot) => {
        const room = snapshot.val();
        if (!room) {
            if (questionIntervalId) clearInterval(questionIntervalId);
            alert('ルームが削除されました。');
            location.reload();
            return;
        }
        if (!room.players || !room.players[currentPlayerId]) {
            if (screens.login.classList.contains('active')) return;
            alert('ルームから退出しました。');
            location.reload();
            return;
        }
        updateUI(room);
    });

    // ★★★ 修正点：接続が切れた時のカウンター更新処理を追加 ★★★
    const playerRef = ref(db, `rooms/${currentRoomName}/players/${currentPlayerId}`);
    const playerCountRef = ref(db, `rooms/${currentRoomName}/playerCount`);

    // 接続が切れたらプレイヤーデータを消すように予約
    onDisconnect(playerRef).remove();
    
    // 接続が切れたらカウンターを-1するトランザクションを予約
    onDisconnect(playerCountRef).transaction((currentCount) => {
        // currentCountがnull(ルームが消滅済みなど)でなければ、-1する
        return currentCount ? currentCount - 1 : null;
    });
}

// (ここから下のUI更新やゲームロジックの関数は、あなたの元のコードのままでOKです)
// (Firebaseへの命令部分は既にv9形式になっているため、修正の必要はありません)

// UIの更新 (変更なし)
function updateUI(room) { /* ... あなたのコードのまま ... */ }
function updateScoreboard(players) { /* ... あなたのコードのまま ... */ }
function showCorrectEffect() { /* ... あなたのコードのまま ... */ }

// ゲーム開始
async function handleStartGame() {
    try {
        const shuffledDeck = createShuffledDeck();
        if (shuffledDeck.length === 0) { return; }
        const firstQuestionIndex = shuffledDeck.shift();
        
        await update(roomRef, {
            gameState: 'playing',
            currentQuestion: window.quizData[firstQuestionIndex],
            questionDeck: shuffledDeck,
            buzzer: null,
            gameStatusText: ''
        });
    } catch (error) { console.error("ゲーム開始エラー:", error); }
}

// 早押し処理
function handleBuzzerPress() {
    const buzzerRef = ref(db, `rooms/${currentRoomName}/buzzer`);
    runTransaction(buzzerRef, (currentBuzzer) => {
        return currentBuzzer === null ? { pressedBy: currentPlayerId } : undefined;
    });
}

// 回答処理
async function handleAnswerSubmit(e) {
    e.preventDefault();
    const submittedAnswer = answerInput.value.trim();
    if (!submittedAnswer) return;

    answerForm.classList.add('hidden');
    answerInput.value = '';

    const snapshot = await get(roomRef);
    const room = snapshot.val();
    // ( ... ここから先のあなたの回答判定ロジックは変更の必要なし ... )
}

// 新しいゲーム
async function handleNewGame() {
    const snapshot = await get(roomRef);
    const room = snapshot.val();
    const updates = {};
    Object.keys(room.players).forEach(playerId => {
        updates[`/players/${playerId}/score`] = 0;
        updates[`/players/${playerId}/misses`] = 0;
    });
    // ★★★ 補足：新しいゲームの際にplayerCountはリセット不要です ★★★
    // (メンバーは変わらないため)
    await update(roomRef, updates); 
}


// --- イベントリスナーの設定 (変更なし) ---
joinRoomButton.addEventListener('click', handleJoinRoom);
// ( ... 他のイベントリスナー ... )


// --- 初期画面表示 (変更なし) ---
showScreen('login');
