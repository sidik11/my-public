    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
    import {
      getDatabase, ref, set, get, update, onValue, onDisconnect, serverTimestamp
    } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

    // Firebase config
    const firebaseConfig = {
      apiKey: "AIzaSyDhYta0w2K_DQwa0SlBDA3FnfRNqog-ejE",
      authDomain: "imagefeed-45d0e.firebaseapp.com",
      databaseURL: "https://imagefeed-45d0e-default-rtdb.firebaseio.com",
      projectId: "imagefeed-45d0e",
      storageBucket: "imagefeed-45d0e.appspot.com",
      messagingSenderId: "886161237670",
      appId: "1:886161237670:web:105822aeb49c11340d7667"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const statusIndicator = document.getElementById('statusIndicator');

    // Connection status
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        statusIndicator.classList.remove('offline');
      } else {
        statusIndicator.classList.add('offline');
      }
    });

    // DOM Elements
    const loginContainer = document.getElementById('loginContainer');
    const appContainer = document.getElementById('appContainer');
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const memberCodeInput = document.getElementById('memberCode');
    const acceptTerms = document.getElementById('acceptTerms');
    const nameError = document.getElementById('nameError');
    const phoneError = document.getElementById('phoneError');
    const codeError = document.getElementById('codeError');
    const termsError = document.getElementById('termsError');
    const usernameEl = document.getElementById('username');
    const firebaseCoinCount = document.getElementById('firebase-coin-count');
    const sessionCoinsEl = document.getElementById('session-coins');
    const miningStatsEl = document.getElementById('miningStats');
    const miningCircle = document.getElementById('miningCircle');
    const transferBtn = document.getElementById('transferBtn');
    const noticeContent = document.getElementById('noticeContent');
    const logoutBtn = document.getElementById('logoutBtn');

    // User data
    let currentUser = null;
    let sessionCoins = 0;
    let firebaseCoins = 0;
    let canMine = true; // Flag to control mining cooldown

    // Initialize app
    window.addEventListener('load', async () => {
      const savedUser = localStorage.getItem('slideUser');
      if (savedUser) {
        currentUser = JSON.parse(savedUser);

        try {
          const userRef = ref(db, `Mining/Users/${currentUser.phone}`);
          const snapshot = await get(userRef);

          if (snapshot.exists()) {
            // Ban check for existing session
            if (snapshot.val().status === "banned") {
              alert("🚫 Your account is suspended. You cannot mine coins.");
              localStorage.removeItem('slideUser');
              loginContainer.style.display = 'block';
              appContainer.style.display = 'none';
              return;
            }

            firebaseCoins = snapshot.val().coins || 0;
            usernameEl.textContent = currentUser.name;
            firebaseCoinCount.textContent = firebaseCoins;

            // Set up realtime updates for coins & notice
            onValue(userRef, (snap) => {
              if (snap.exists()) {
                const data = snap.val();
                firebaseCoins = data.coins || 0;
                firebaseCoinCount.textContent = firebaseCoins;
                noticeContent.textContent = data.notice || `Welcome ${currentUser.name}!`;
              }
            });

            // Auto-logout if admin sets `logout = true`
            onValue(userRef, (snap) => {
              if (snap.exists() && snap.val().logout === true) {
                alert("⚠️ An update arrived, Please Relogin.");

                // Clear data
                localStorage.removeItem('slideUser');
                localStorage.removeItem('sessionCoins');
                currentUser = null;
                sessionCoins = 0;

                // Reset UI
                sessionCoinsEl.textContent = '0';
                firebaseCoinCount.textContent = '0';
                usernameEl.textContent = 'Guest Miner';
                miningStatsEl.textContent = 'Click the circle to start mining coins!';
                loginContainer.style.display = 'block';
                appContainer.style.display = 'none';

                // Clear input
                nameInput.value = '';
                phoneInput.value = '';
                memberCodeInput.value = '';
                acceptTerms.checked = false;

                // Reset logout flag to allow re-login
                update(userRef, { logout: false });
              }
            });

            // Load saved session coins
            const savedSessionCoins = localStorage.getItem('sessionCoins');
            sessionCoins = savedSessionCoins ? parseInt(savedSessionCoins) : 0;
            sessionCoinsEl.textContent = sessionCoins;

            showApp();
          } else {
            localStorage.removeItem('slideUser');
            loginContainer.style.display = 'block';
            appContainer.style.display = 'none';
          }
        } catch (error) {
          console.error('Session restore error:', error);
          localStorage.removeItem('slideUser');
          loginContainer.style.display = 'block';
          appContainer.style.display = 'none';
        }
      }
    });

    // Login functionality
    loginBtn.addEventListener('click', async () => {
      // Reset errors
      nameError.style.display = 'none';
      phoneError.style.display = 'none';
      codeError.style.display = 'none';
      termsError.style.display = 'none';
      
      // Get input values
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const memberCode = memberCodeInput.value.trim();
      const termsAccepted = acceptTerms.checked;
      
      // Validate inputs
      let isValid = true;
      if (!name) {
        nameError.style.display = 'block';
        isValid = false;
      }
      if (!phone || phone.length < 10) {
        phoneError.style.display = 'block';
        isValid = false;
      }
      if (!memberCode) {
        codeError.style.display = 'block';
        isValid = false;
      }
      if (!termsAccepted) {
        termsError.style.display = 'block';
        isValid = false;
      }
      
      if (!isValid) return;
      
      // Show loading spinner
      loginBtn.style.display = 'none';
      loginSpinner.style.display = 'block';
      
      try {
        // Create user object
        const user = {
          name,
          phone,
          memberCode,
          coins: 0,
          lastLogin: new Date().toISOString(),
          notice: `Welcome ${name}!`, // Default notice
          termsAccepted: true,
          termsAcceptedDate: new Date().toISOString()
        };
        
        // Save user to Firebase
        const userRef = ref(db, `Mining/Users/${phone}`);
        
        // Check if user exists
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          // Ban check for login
          if (snapshot.val().status === "banned") {
            alert("🚫 Your account is suspended. You cannot mine coins.");
            loginBtn.style.display = 'block';
            loginSpinner.style.display = 'none';
            return;
          }

          // Existing user - update last login and terms acceptance
          await update(userRef, {
            lastLogin: new Date().toISOString(),
            termsAccepted: true,
            termsAcceptedDate: new Date().toISOString()
          });
          // Get existing coins
          firebaseCoins = snapshot.val().coins || 0;
          
          // Use existing notice if available, otherwise set default
          if (snapshot.val().notice) {
            noticeContent.textContent = snapshot.val().notice;
          } else {
            noticeContent.textContent = `Welcome ${name}!`;
          }
        } else {
          // New user - create record with default notice
          await set(userRef, user);
          firebaseCoins = 0;
          noticeContent.textContent = `Welcome ${name}!`;
        }
        
        // Set current user
        currentUser = {
          name,
          phone,
          memberCode
        };
        
        // Save to localStorage
        localStorage.setItem('slideUser', JSON.stringify(currentUser));
        
        // Update UI
        usernameEl.textContent = name;
        firebaseCoinCount.textContent = firebaseCoins;
        
        // Set up realtime listener for coin updates
        onValue(userRef, (snap) => {
          if (snap.exists()) {
            firebaseCoins = snap.val().coins || 0;
            firebaseCoinCount.textContent = firebaseCoins;
            
            // Update notice if it exists in user data
            if (snap.val().notice) {
              noticeContent.textContent = snap.val().notice;
            }
          }
        });
        
        // Show app
        showApp();
        
      } catch (error) {
        console.error('Login error:', error);
        miningStatsEl.textContent = 'Login failed. Please try again.';
      } finally {
        // Hide spinner, show button
        loginBtn.style.display = 'block';
        loginSpinner.style.display = 'none';
      }
    });

    // Show the app interface
    function showApp() {
      loginContainer.style.display = 'none';
      appContainer.style.display = 'block';
      
      // Set up mining event
      miningCircle.addEventListener("click", mineCoins);
      
      // Set up transfer event
      transferBtn.addEventListener("click", transferCoins);
    }

    // Mining functionality with 0.3-second cooldown
    function mineCoins(e) {
      if (!currentUser || !canMine) return;
      
      // Ban check for mining
      const userRef = ref(db, `Mining/Users/${currentUser.phone}`);
      get(userRef).then(snapshot => {
        if (snapshot.exists() && snapshot.val().status === "banned") {
          alert("🚫 You are banned from mining.");
          return;
        }

        // Set cooldown
        canMine = false;
        setTimeout(() => {
          canMine = true;
        }, 300); // 0.3 second cooldown
        
        // Create visual effects
        createClickEffect(e);
        createCoinAnimation(e);
        
        // Calculate new coins
        const coinsEarned = 1 + Math.floor(Math.random() * 2); // 1-2 coins per tap
        sessionCoins += coinsEarned;
        
        // Update UI
        sessionCoinsEl.textContent = sessionCoins;
        miningStatsEl.textContent = `+${coinsEarned} coins mined! Session: ${sessionCoins}`;
        
        // Save to localStorage
        localStorage.setItem('sessionCoins', sessionCoins);
        
        // Reset message after 3 seconds
        setTimeout(() => {
          miningStatsEl.textContent = "Keep mining for more coins!";
        }, 3000);
      });
    }

    // Transfer coins to Firebase
    async function transferCoins() {
      if (!currentUser || sessionCoins <= 0) return;
      
      try {
        // Show loading
        transferBtn.textContent = "Transferring...";
        transferBtn.disabled = true;
        
        // Get current user reference
        const userRef = ref(db, `Mining/Users/${currentUser.phone}`);
        
        // Get current coin balance from Firebase
        const snapshot = await get(userRef);
        let currentCoins = 0;
        
        if (snapshot.exists()) {
          currentCoins = snapshot.val().coins || 0;
        }
        
        // Calculate new balance
        const newCoins = currentCoins + sessionCoins;
        
        // Update Firebase
        await update(userRef, {
          coins: newCoins,
          lastTransfer: serverTimestamp()
        });
        
        // Update UI
        firebaseCoins = newCoins;
        firebaseCoinCount.textContent = newCoins;
        
        // Reset session coins
        sessionCoins = 0;
        sessionCoinsEl.textContent = sessionCoins;
        localStorage.setItem('sessionCoins', sessionCoins);
        
        // Show success message
        miningStatsEl.textContent = `Success! ${sessionCoins} coins transferred to your account.`;
        
        // Create transfer history
        const transferRef = ref(db, `Mining/Transfers/${currentUser.phone}/${Date.now()}`);
        await set(transferRef, {
          amount: sessionCoins,
          timestamp: serverTimestamp()
        });
        
      } catch (error) {
        console.error('Transfer error:', error);
        miningStatsEl.textContent = "Transfer failed. Please try again.";
      } finally {
        // Reset button
        transferBtn.textContent = "CV Transfer";
        transferBtn.disabled = false;
        
        // Reset message after 5 seconds
        setTimeout(() => {
          miningStatsEl.textContent = "Keep mining for more coins!";
        }, 5000);
      }
    }

    // Create coin animation
    function createCoinAnimation(e) {
      const rect = miningCircle.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      for (let i = 0; i < 5; i++) {
        const coin = document.createElement("div");
        coin.className = "mining-coins";
        coin.textContent = "+1";
        coin.style.left = x + "px";
        coin.style.top = y + "px";
        
        // Randomize animation direction
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 50;
        const tx = Math.cos(angle) * distance;
        const ty = -Math.abs(Math.sin(angle) * distance);
        
        coin.style.setProperty('--tx', `${tx}px`);
        coin.style.setProperty('--ty', `${ty}px`);
        
        miningCircle.appendChild(coin);
        
        // Remove coin element after animation completes
        setTimeout(() => {
          if (coin.parentNode) coin.parentNode.removeChild(coin);
        }, 1500);
      }
    }

    // Create click effect
    function createClickEffect(e) {
      const rect = miningCircle.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const effect = document.createElement("div");
      effect.style.position = "absolute";
      effect.style.width = "20px";
      effect.style.height = "20px";
      effect.style.background = "rgba(255, 255, 255, 0.8)";
      effect.style.borderRadius = "50%";
      effect.style.pointerEvents = "none";
      effect.style.left = x + "px";
      effect.style.top = y + "px";
      effect.style.transform = "translate(-50%, -50%)";
      effect.style.animation = "clickRipple 0.6s ease-out";
      
      miningCircle.appendChild(effect);
      
      // Remove effect element after animation completes
      setTimeout(() => {
        effect.remove();
      }, 600);
    }

    // Show redeem info
    function showRedeemInfo() {
      document.getElementById('redeemModal').style.display = 'block';
    }

    // Logout functionality
    logoutBtn.addEventListener('click', () => {
      // Clear user data
      localStorage.removeItem('slideUser');
      localStorage.removeItem('sessionCoins');
      currentUser = null;
      sessionCoins = 0;
      
      // Reset UI
      sessionCoinsEl.textContent = '0';
      firebaseCoinCount.textContent = '0';
      usernameEl.textContent = 'Guest Miner';
      miningStatsEl.textContent = 'Click the circle to start mining coins!';
      
      // Show login, hide app
      loginContainer.style.display = 'block';
      appContainer.style.display = 'none';
      
      // Reset form
      nameInput.value = '';
      phoneInput.value = '';
      memberCodeInput.value = '';
      acceptTerms.checked = false;
    });

    // Add CSS for click ripple animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes clickRipple {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(10);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
