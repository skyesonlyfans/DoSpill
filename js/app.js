// app.js - Main Application Script for DoSpill
// This file handles the main application logic, including user authentication, chat management, and UI rendering
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
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
    getDoc,
    updateDoc,
    orderBy,
    arrayUnion,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Services & App State ---
    const auth = getAuth();
    const db = getFirestore();
    const root = document.getElementById('root');
    let currentUser = null;
    let currentUserProfile = null;
    let currentChatId = null;
    let currentChatUnsubscribe = null;
    let currentListeners = []; // Store active listeners to detach them later

    // --- Modal Control ---
    const modal = {
        backdrop: document.getElementById('modal-backdrop'),
        box: document.getElementById('modal-box'),
        title: document.getElementById('modal-title'),
        text: document.getElementById('modal-text'),
        inputContainer: document.getElementById('modal-input-container'),
        input: document.getElementById('modal-input'),
        confirmBtn: document.getElementById('modal-confirm-btn'),
        cancelBtn: document.getElementById('modal-cancel-btn'),
        _onConfirm: null,

        show: function({ title, text, input, confirmText = 'Confirm', onConfirm }) {
            this.title.textContent = title;
            this.text.textContent = text;
            this.confirmBtn.textContent = confirmText;
            
            if (input) {
                this.input.placeholder = input.placeholder || '';
                this.input.value = '';
                this.inputContainer.style.display = 'block';
            } else {
                this.inputContainer.style.display = 'none';
            }
            
            this._onConfirm = onConfirm;
            this.backdrop.style.display = 'flex';
        },
        hide: function() {
            this.backdrop.style.display = 'none';
            this._onConfirm = null;
        }
    };
    modal.confirmBtn.addEventListener('click', () => {
        if (modal._onConfirm) {
            modal._onConfirm(modal.input.value);
        }
    });
    modal.cancelBtn.addEventListener('click', () => modal.hide());

    // --- Main Auth Observer ---
    onAuthStateChanged(auth, async (user) => {
        detachAllListeners(); // Clean up old listeners on auth state change
        if (user) {
            const userRef = doc(db, "users", user.uid);
            let userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                // New user, create profile document
                const profile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || (user.isAnonymous ? `Guest-${user.uid.substring(0, 6)}` : 'New User'),
                    profilePicture: user.photoURL || `https://placehold.co/100x100/5856d6/FFFFFF?text=${(user.displayName || 'G').charAt(0)}`,
                    createdAt: serverTimestamp(),
                    pronouns: 'Prefer not to say'
                };
                await setDoc(userRef, profile);
                currentUserProfile = profile;
                renderProfileSetup(); // Guide new user through profile setup
            } else {
                currentUserProfile = userDoc.data();
                if (currentUserProfile.isBanned) {
                    await signOut(auth);
                    // Can't render auth page here as it would cause a loop
                    alert("Your account has been banned.");
                    root.innerHTML = `<div class="auth-page"><h1 class="auth-logo">Do<span>Spill</span></h1><p>Your account is banned.</p></div>`;
                } else {
                    currentUser = user;
                    renderApp();
                }
            }
        } else {
            renderAuthPage();
        }
    });

    // --- Render Functions ---

    function renderAuthPage() {
        root.innerHTML = `
            <div class="auth-page">
                <h1 class="auth-logo">Do<span>Spill</span></h1>
                <p>Connect instantly. Spill freely.</p>
                <div class="auth-options">
                    <button class="auth-btn google-btn" id="google-signin">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,36.62,44,31.1,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                        Continue with Google
                    </button>
                    <button class="auth-btn email-btn" id="email-signin">Continue with Email</button>
                    <button class="auth-btn guest-btn" id="guest-signin">Continue as Guest</button>
                </div>
            </div>
        `;
        addAuthPageEventListeners();
    }
    
    function renderProfileSetup() {
        // A simplified profile setup for new users
        modal.show({
            title: 'Welcome to DoSpill!',
            text: 'Let\'s set up your display name.',
            input: { placeholder: currentUserProfile.displayName || 'Enter your name' },
            confirmText: 'Save & Continue',
            onConfirm: async (newName) => {
                const name = newName.trim();
                if (name) {
                    await updateDoc(doc(db, "users", currentUser.uid), { displayName: name });
                    currentUserProfile.displayName = name;
                    modal.hide();
                    renderApp();
                }
            }
        });
    }

    function renderApp() {
        root.innerHTML = `
            <div class="app-container">
                <header class="app-header">
                    <h1>Chats</h1>
                    <button class="header-btn" id="profile-btn">Profile</button>
                </header>
                <main class="chat-list">
                    <div class="chat-list-actions">
                        <button class="action-btn" id="create-group-btn">New Group</button>
                        <button class="action-btn" id="join-group-btn">Join Group</button>
                    </div>
                    <div id="chats-container"></div>
                </main>
            </div>
        `;
        addAppEventListeners();
        renderChatList();
    }
    
    function renderChatWindow(chatId, chatInfo) {
        currentChatId = chatId;
        const memberCount = chatInfo.participants ? chatInfo.participants.length : 0;
        root.innerHTML = `
            <div class="chat-window">
                <header class="chat-header">
                    <button class="back-button" id="back-to-chats">&lt;</button>
                    <div class="chat-header-info">
                        <h2>${chatInfo.name}</h2>
                        <p>${memberCount} Members</p>
                    </div>
                </header>
                <div class="message-area" id="message-area">
                    <div class="messages-container" id="messages-container"></div>
                </div>
                <footer class="message-input-area">
                    <button id="add-media-btn">+</button>
                    <input type="text" class="message-input" id="message-input" placeholder="Message in ${chatInfo.name}..." autocomplete="off">
                    <button id="send-btn">→</button>
                </footer>
            </div>
        `;
        addChatWindowEventListeners();
        renderMessages(chatId);
    }

    // --- Event Listener Setup ---

    function addAuthPageEventListeners() {
        document.getElementById('google-signin').addEventListener('click', handleGoogleSignIn);
        document.getElementById('email-signin').addEventListener('click', handleEmailSignIn);
        document.getElementById('guest-signin').addEventListener('click', handleGuestSignIn);
    }
    
    function addAppEventListeners() {
        document.getElementById('profile-btn').addEventListener('click', () => signOut(auth));
        document.getElementById('create-group-btn').addEventListener('click', handleCreateGroup);
        document.getElementById('join-group-btn').addEventListener('click', handleJoinGroup);
    }
    
    function addChatWindowEventListeners() {
        document.getElementById('back-to-chats').addEventListener('click', renderApp);
        document.getElementById('send-btn').addEventListener('click', handleSendMessage);
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSendMessage();
        });
    }

    // --- Auth Handlers ---
    
    async function handleGoogleSignIn() {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google Sign-In Error", error);
        }
    }
    
    async function handleGuestSignIn() {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Guest Sign-In Error", error);
        }
    }
    
    function handleEmailSignIn() {
        modal.show({
            title: 'Continue with Email',
            text: '',
            input: { placeholder: 'Email' },
            confirmText: 'Next',
            onConfirm: (email) => {
                modal.show({
                    title: 'Enter Password',
                    text: `For email: ${email}`,
                    input: { placeholder: 'Password' },
                    confirmText: 'Sign In',
                    onConfirm: async (password) => {
                        try {
                            await signInWithEmailAndPassword(auth, email, password);
                            modal.hide();
                        } catch (error) {
                            // User likely doesn't exist, prompt to sign up
                            if (error.code === 'auth/user-not-found') {
                                modal.show({
                                    title: 'Create Account',
                                    text: `No account found for ${email}. Create one now?`,
                                    confirmText: 'Sign Up',
                                    onConfirm: async () => {
                                        try {
                                            await createUserWithEmailAndPassword(auth, email, password);
                                            modal.hide();
                                        } catch (e) { console.error(e); }
                                    }
                                });
                            }
                        }
                    }
                });
            }
        });
    }

    // --- App Logic Handlers ---
    
    function handleCreateGroup() {
        modal.show({
            title: 'Create New Group',
            text: 'Give your new group a name.',
            input: { placeholder: 'Group Name' },
            confirmText: 'Create',
            onConfirm: async (groupName) => {
                if (groupName.trim()) {
                    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                    await addDoc(collection(db, 'chats'), {
                        name: groupName.trim(),
                        type: 'group',
                        participants: [currentUser.uid],
                        createdBy: currentUser.uid,
                        createdAt: serverTimestamp(),
                        inviteCode: inviteCode
                    });
                    modal.hide();
                }
            }
        });
    }
    
    function handleJoinGroup() {
        modal.show({
            title: 'Join a Group',
            text: 'Enter the 6-character invite code.',
            input: { placeholder: 'ABCXYZ' },
            confirmText: 'Join',
            onConfirm: async (code) => {
                if (code.trim().length === 6) {
                    const q = query(collection(db, 'chats'), where('inviteCode', '==', code.trim().toUpperCase()));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const chatDoc = querySnapshot.docs[0];
                        await updateDoc(chatDoc.ref, {
                            participants: arrayUnion(currentUser.uid)
                        });
                        modal.hide();
                    } else {
                        alert('Invalid invite code.');
                    }
                }
            }
        });
    }
    
    function handleSendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        if (text && currentChatId) {
            addDoc(collection(db, 'chats', currentChatId, 'messages'), {
                text: text,
                senderId: currentUser.uid,
                senderName: currentUserProfile.displayName,
                createdAt: serverTimestamp()
            });
            input.value = '';
        }
    }

    // --- Data Rendering & Listeners ---
    
    function renderChatList() {
        const container = document.getElementById('chats-container');
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!container) return;
            container.innerHTML = '';
            snapshot.docs.forEach(doc => {
                const chat = doc.data();
                const el = document.createElement('div');
                el.className = 'chat-preview';
                el.innerHTML = `
                    <img src="https://placehold.co/100x100/2c2c2e/FFFFFF?text=${chat.name.charAt(0).toUpperCase()}" alt="group icon">
                    <div class="chat-info">
                        <h2>${chat.name}</h2>
                        <p>${chat.lastMessage || 'Tap to start chatting...'}</p>
                    </div>
                `;
                el.addEventListener('click', () => renderChatWindow(doc.id, chat));
                container.appendChild(el);
            });
        });
        currentListeners.push(unsubscribe); // Track listener
    }
    
    function renderMessages(chatId) {
        const container = document.getElementById('messages-container');
        const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
        
        currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
            if (!container) return;
            container.innerHTML = '';
            snapshot.docs.forEach(doc => {
                const msg = doc.data();
                const el = document.createElement('div');
                const isSent = msg.senderId === currentUser.uid;
                el.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
                el.innerHTML = `
                    ${!isSent ? `<div class="sender-name">${msg.senderName}</div>` : ''}
                    <div class="message-text">${msg.text}</div>
                `;
                container.appendChild(el);
            });
            container.parentElement.scrollTop = container.parentElement.scrollHeight;
        });
        currentListeners.push(currentChatUnsubscribe);
    }
    
    function detachAllListeners() {
        currentListeners.forEach(unsubscribe => unsubscribe());
        currentListeners = [];
    }
});
