// js/app.js

import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const auth = getAuth();
    const db = getFirestore();

    const root = document.getElementById('root');

    // --- State Management ---
    let currentUser = null;
    let currentChatId = null;
    let isLoginView = true;

    // --- Auth State Observer ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            renderApp();
        } else {
            // User is signed out
            currentUser = null;
            renderAuth();
        }
    });

    // --- Render Functions ---

    // Render Authentication (Login/Signup) View
    function renderAuth() {
        root.innerHTML = `
            <div class="auth-container">
                <h1>${isLoginView ? 'Welcome Back' : 'Create Account'}</h1>
                <form class="auth-form" id="auth-form">
                    <input type="email" id="email" placeholder="Email" required>
                    <input type="password" id="password" placeholder="Password" required>
                    <button type="submit">${isLoginView ? 'Log In' : 'Sign Up'}</button>
                </form>
                <button class="toggle-auth" id="toggle-auth-btn">
                    ${isLoginView ? 'Need an account? Sign Up' : 'Have an account? Log In'}
                </button>
            </div>
        `;
        addAuthEventListeners();
    }

    // Render Main App View (Chat List)
    function renderApp() {
        root.innerHTML = `
            <div class="app-container">
                <header class="chat-list-header">
                    <h1>Chats</h1>
                    <button id="logout-btn">Logout</button>
                </header>
                <main class="chat-list" id="chat-list-container">
                    <!-- Chat previews will be rendered here -->
                </main>
            </div>
        `;
        addAppEventListeners();
        renderChatList();
    }
    
    // Render Chat Window
    function renderChatWindow(chatId, recipientInfo) {
        currentChatId = chatId;
        root.innerHTML = `
             <div class="chat-window">
                <header class="chat-header">
                    <button class="back-button" id="back-to-chats">&lt; Chats</button>
                    <div class="chat-header-info">
                        <h2>${recipientInfo.username || 'Chat'}</h2>
                    </div>
                </header>
                <div class="message-area" id="message-area">
                   <div class="messages-container" id="messages-container">
                        <!-- Messages will be rendered here -->
                   </div>
                </div>
                <footer class="message-input-area">
                    <input type="text" class="message-input" id="message-input" placeholder="Message...">
                    <button class="send-button" id="send-btn">Send</button>
                </footer>
            </div>
        `;
        addChatWindowEventListeners();
        renderMessages(chatId);
    }


    // --- Event Listeners ---

    function addAuthEventListeners() {
        const authForm = document.getElementById('auth-form');
        const toggleBtn = document.getElementById('toggle-auth-btn');

        authForm.addEventListener('submit', handleAuthSubmit);
        toggleBtn.addEventListener('click', toggleAuthView);
    }

    function addAppEventListeners() {
        const logoutBtn = document.getElementById('logout-btn');
        logoutBtn.addEventListener('click', handleLogout);
        // Event delegation for chat previews
        const chatListContainer = document.getElementById('chat-list-container');
        chatListContainer.addEventListener('click', (e) => {
            const chatPreview = e.target.closest('.chat-preview');
            if (chatPreview) {
                const chatId = chatPreview.dataset.chatId;
                const recipientId = chatPreview.dataset.recipientId;
                // We'd fetch recipient info properly in a real app
                // For now, just using a placeholder
                getDoc(doc(db, "users", recipientId)).then(userDoc => {
                     renderChatWindow(chatId, userDoc.data() || { username: 'User' });
                });
            }
        });
    }

    function addChatWindowEventListeners() {
        const backBtn = document.getElementById('back-to-chats');
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');

        backBtn.addEventListener('click', renderApp);
        sendBtn.addEventListener('click', handleSendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }


    // --- Event Handlers ---

    function toggleAuthView() {
        isLoginView = !isLoginView;
        renderAuth();
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (isLoginView) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Create a user profile document in Firestore
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: userCredential.user.email,
                    username: email.split('@')[0], // default username
                    createdAt: serverTimestamp(),
                    profilePicture: '/icons/default-profile.png' // default pfp
                });
            }
            // onAuthStateChanged will handle rendering the app
        } catch (error) {
            console.error("Authentication error:", error);
            alert(error.message);
        }
    }

    async function handleLogout() {
        try {
            await signOut(auth);
            // onAuthStateChanged will handle rendering the auth view
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
    
    async function handleSendMessage() {
        const messageInput = document.getElementById('message-input');
        const messageText = messageInput.value.trim();

        if (messageText && currentChatId) {
            try {
                await addDoc(collection(db, "chats", currentChatId, "messages"), {
                    text: messageText,
                    senderId: currentUser.uid,
                    createdAt: serverTimestamp()
                });
                messageInput.value = ''; // Clear input
            } catch(error) {
                console.error("Error sending message: ", error);
            }
        }
    }


    // --- Data Rendering ---
    
    function renderChatList() {
        const chatListContainer = document.getElementById('chat-list-container');
        if (!chatListContainer) return;
        
        const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
        
        onSnapshot(q, (querySnapshot) => {
            chatListContainer.innerHTML = ''; // Clear old list
            querySnapshot.forEach(async (doc) => {
                const chat = doc.data();
                const chatId = doc.id;
                const recipientId = chat.participants.find(p => p !== currentUser.uid);

                if(recipientId) {
                    const userDoc = await getDoc(doc(db, "users", recipientId));
                    const recipientInfo = userDoc.data();
                    
                    const previewEl = document.createElement('div');
                    previewEl.className = 'chat-preview';
                    previewEl.dataset.chatId = chatId;
                    previewEl.dataset.recipientId = recipientId;
                    previewEl.innerHTML = `
                        <img src="${recipientInfo.profilePicture || '/icons/default-profile.png'}" alt="pfp">
                        <div class="chat-info">
                            <h2>${recipientInfo.username || 'User'}</h2>
                            <p>Last message...</p> <!-- Placeholder -->
                        </div>
                    `;
                    chatListContainer.appendChild(previewEl);
                }
            });
        });
    }

    function renderMessages(chatId) {
        const messagesContainer = document.getElementById('messages-container');
        if(!messagesContainer) return;

        const q = query(collection(db, "chats", chatId, "messages")); // Add orderBy in real app

        onSnapshot(q, (querySnapshot) => {
            messagesContainer.innerHTML = '';
            querySnapshot.forEach(doc => {
                const message = doc.data();
                const messageEl = document.createElement('div');
                messageEl.className = 'message-bubble';
                
                if (message.senderId === currentUser.uid) {
                    messageEl.classList.add('sent');
                } else {
                    messageEl.classList.add('received');
                }
                
                messageEl.textContent = message.text;
                messagesContainer.prepend(messageEl); // Prepend to keep order with flex-direction: column-reverse
            });
        });
    }

});
