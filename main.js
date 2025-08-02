
// main.js

// ▼▼▼ Firebase v9の関数をインポート ▼▼▼
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth";
import { getDatabase, ref, runTransaction, onValue, onDisconnect, get, set, update } from "firebase/database";

// あなたのFirebaseプロジェクトの設定情報
const firebaseConfig = {
  apiKey: "AIzaSyCwRAgSfOOPpOrEH7wJdCmLHtOgJOb2ZKg",// 
  authDomain: "quiz-app-ab0b2.firebaseapp.com",
  databaseURL: "https://quiz-app-ab0b2-default-rtdb.firebaseio.com",
  projectId: "quiz-app-ab0b2",
  storageBucket: "quiz-app-ab0b2.appspot.com",
  messagingSenderId: "825831547139",
  appId: "1:825831547139:web:e49f693e37afa444b18936",
  measurementId: "G-RYX5Z4YHDC"
};

// Firebaseを初期化します
// ▲▲▲ 以下に書き換える ▲▲▲
// --- Firebaseの初期化（認証を追加） ---
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth(); // 認証を追加

// 認証状態の監視
let currentUserId = null;
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserId = user.uid;
        console.log('認証完了:', currentUserId);
    } else {
        console.log('未認証');
    }
});


// ★★★ ここに新しく追加 ★★★
// アプリ初期化時に認証状態監視を開始
function initializeAuth() {
    return new Promise((resolve) => {
        console.log('🔄 認証システム初期化中...');
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('🔔 認証状態変更:', user ? `認証済み(${user.uid})` : '未認証');
            
            if (user) {
                currentPlayerId = user.uid;
                authenticationComplete = true;
                console.log('✅ 認証システム準備完了');
                unsubscribe();
                resolve(user);
            }
        });
    });
}
// 認証が完了するまで待つヘルパー関数
function waitForAuth() {
    return new Promise((resolve) => {
        if (isAuthReady) {
            resolve(currentUser);
            return;
        }
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            currentUser = user;
            isAuthReady = true;
            resolve(user);
        });
    });
}

// 匿名認証を行い、完了まで待つ関数
async function ensureAuthenticated() {
    // 既に認証済みの場合はそのまま返す
    await waitForAuth();
    
    if (currentUser) {
        console.log('既に認証済み:', currentUser.uid);
        return currentUser;
    }
    
    // 未認証の場合、匿名認証を実行
    console.log('匿名認証を開始...');
    await signInAnonymously(auth);
    
    // 認証完了を待つ
    return await waitForAuth();
}


// 認証状態を確実に確認する関数
async function ensureUserAuthenticated() {
    console.log('🔍 認証状態チェック中...');
    
    // 既に認証完了している場合
    if (authenticationComplete && auth.currentUser) {
        console.log('✅ 既に認証済み:', auth.currentUser.uid);
        return auth.currentUser;
    }
    
    // 認証が未完了の場合、匿名認証を実行
    console.log('🚀 匿名認証開始...');
    
    try {
        const userCredential = await signInAnonymously(auth);
        
        // 認証完了後、セキュリティルールに反映されるまで待機
        console.log('⏳ セキュリティルール反映待機...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 認証状態を再確認
        if (!auth.currentUser) {
            throw new Error('認証後にユーザー情報が取得できません');
        }
        
        authenticationComplete = true;
        currentPlayerId = auth.currentUser.uid;
        console.log('✅ 認証完全完了:', currentPlayerId);
        
        return auth.currentUser;
        
    } catch (error) {
        console.error('❌ 認証エラー:', error);
        throw error;
    }
}


// Firebaseの各サービスを利用可能にします
export const db = getDatabase(app);       // Realtime Database のインスタンスを取得
export const auth = getAuth(app);         // Firebase Authentication のインスタンスを取得
const analytics = getAnalytics(app);      // Google Analytics (任意)

// ▲▲▲ あなたのFirebase設定情報をここに貼り付け ▲▲▲

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
// ★★★ ここに新しく追加 ★★★
let isAuthReady = false;
let currentUser = null;
// (定数なども変更なし)
const MAX_PLAYERS = 4;
const WIN_SCORE = 7;
const LOSE_MISSES = 3;
// 認証完了フラグ
let authenticationComplete = false;


// --- 画面遷移 (変更なし) ---
function showScreen(screenName) { /* ... */ } // (この部分はあなたのコードのままでOK)

// --- クイズの山札を作成 (変更なし) ---
function createShuffledDeck() { /* ... */ } // (この部分はあなたのコードのままでOK)


// --- ルームへの参加/作成処理（認証対応版） ---
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
        // ★★★ 1. 匿名認証を実行 ★★★
        if (!auth.currentUser) {
            console.log('匿名認証開始...');
            await auth.signInAnonymously();
            // 認証完了を待つ
            await new Promise(resolve => {
                const unsubscribe = auth.onAuthStateChanged(user => {
                    if (user) {
                        unsubscribe();
                        resolve();
                    }
                });
            });
        }

        currentPlayerId = auth.currentUser.uid;
        console.log('認証済みUID:', currentPlayerId);

        // ★★★ 2. セキュリティルール反映のため少し待機 ★★★
        await new Promise(resolve => setTimeout(resolve, 500));

        currentRoomName = roomName;
        roomRef = db.ref(`rooms/${currentRoomName}`);

        // ★★★ 3. トランザクションでルーム参加 ★★★
        const result = await roomRef.transaction((room) => {
            if (room === null) {
                // 新規ルーム作成
                isHost = true;
                return {
                    password: password,
                    playerCount: 1,
                    players: {
                        [currentPlayerId]: { 
                            name: playerName, 
                            score: 0, 
                            misses: 0, 
                            host: true 
                        }
                    },
                    gameState: 'waiting',
                    hostId: currentPlayerId
                };
            } else {
                // 既存ルーム参加
                if (room.password && room.password !== password) {
                    return; // パスワード不一致で中断
                }
                
                const currentCount = room.playerCount || 0;
                if (currentCount >= MAX_PLAYERS) {
                    return; // 満員で中断
                }

                isHost = false;
                if (!room.players) room.players = {};
                
                room.players[currentPlayerId] = { 
                    name: playerName, 
                    score: 0, 
                    misses: 0, 
                    host: false 
                };
                room.playerCount = currentCount + 1;
                
                return room;
            }
        });

        if (!result.committed) {
            // トランザクション失敗の場合
            const snapshot = await roomRef.once('value');
            const room = snapshot.val();
            if (room && room.password && room.password !== password) {
                loginError.textContent = 'パスワードが違います。';
            } else {
                loginError.textContent = 'このルームは満員です。';
            }
            await auth.signOut();
            return;
        }

        // 参加成功
        console.log('ルーム参加成功！');
        setupRoomListener();

    } catch (error) {
        console.error("ルーム参加処理エラー:", error);
        loginError.textContent = 'エラーが発生しました。再度お試しください。';
    } finally {
        joinRoomButton.disabled = false;
    }
}


// --- ルームの状態を監視（修正版） ---
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
        
        // プレイヤーが存在するかチェック
        if (!room.players || !room.players[currentPlayerId]) {
            alert('ルームから退出しました。');
            location.reload();
            return;
        }
        
        updateUI(room);
    });

    // 接続切断時の処理
    const playerRef = roomRef.child(`players/${currentPlayerId}`);
    const playerCountRef = roomRef.child('playerCount');
    
    playerRef.onDisconnect().remove();
    playerCountRef.onDisconnect().transaction(currentCount => {
        return currentCount ? currentCount - 1 : null;
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


// ▼▼▼ 退出処理の修正 ▼▼▼
// 「ログイン画面に戻る」ボタンの処理を修正
goToLoginButton.addEventListener('click', async () => {
    if (roomRef && currentPlayerId) {
        await roomRef.child(`players/${currentPlayerId}`).remove();
        
        // playerCountを減らす
        await roomRef.child('playerCount').transaction(currentCount => {
            return currentCount ? currentCount - 1 : null;
        });
    }
    
    if (auth.currentUser) {
        await auth.signOut();
    }
    
    location.reload();
});


// --- 初期画面表示 (変更なし) ---
showScreen('login');
