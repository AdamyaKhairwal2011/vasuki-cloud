import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aitckloahlwemlekaour.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE = "users";

const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const loginBtn = document.querySelector("#loginBtn");
const googleLoginBtn = document.querySelector("#googleLoginBtn");

// --------------------------
// MPIN Quick Login
// --------------------------
if (localStorage.getItem("userid")) {
  const storedMpin = localStorage.getItem("mpin");
  const mpinEntered = prompt("Enter your MPIN to continue:");
  if (mpinEntered === storedMpin) {
    window.location.href = `dashboard.html?authentication=${localStorage.getItem("userid")}`;
  } else {
    alert("Incorrect MPIN. Please login again.");
    localStorage.removeItem("userid");
    localStorage.removeItem("user_id");
    localStorage.removeItem("mpin");
  }
}

// --------------------------
// NORMAL LOGIN
// --------------------------
loginBtn.addEventListener("click", async () => {
  if (!emailInput.value || !passwordInput.value) {
    alert("Please fill all fields");
    return;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("username", emailInput.value.toLowerCase())
    .eq("password", passwordInput.value);

  if (error) {
    alert("Error logging in: " + error.message);
    return;
  }

  if (data.length === 0) {
    alert("Invalid email or password");
    return;
  }

  const user = data[0];
  localStorage.setItem("userid", user.id);
  localStorage.setItem("user_id", user.id);

  // Ask for MPIN if not set
  let mpin = localStorage.getItem("mpin");
  if (!mpin) {
    mpin = prompt("Login successful! Please set a 4-digit MPIN for quicker access next time:");
    localStorage.setItem("mpin", mpin);
  }

  window.location.href = `dashboard.html?authentication=${user.id}`;
});

// --------------------------
// GOOGLE LOGIN (Email Only)
// --------------------------
googleLoginBtn.addEventListener("click", () => {
  const client = google.accounts.oauth2.initCodeClient({
    client_id: "600593339063-blt9bcoe1k382f82ri4gd7a2el2bqfv1.apps.googleusercontent.com",
    scope: "openid email profile",
    ux_mode: "popup",
    redirect_uri: "postmessage",
    callback: async (response) => {
      try {
        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: response.code,
            client_id: "600593339063-blt9bcoe1k382f82ri4gd7a2el2bqfv1.apps.googleusercontent.com",
            client_secret: "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",
            redirect_uri: "postmessage",
            grant_type: "authorization_code",
          }),
        }).then(r => r.json());

        if (!tokenRes.access_token) throw new Error("No access token");

        // Get user info
        const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenRes.access_token}` },
        }).then(r => r.json());

        const email = userInfo.email.toLowerCase();
        const name = userInfo.name;
        const picture = userInfo.picture;

        // Check if email exists
        let { data: existingUser } = await supabase
          .from(TABLE)
          .select("*")
          .eq("username", email)
          .limit(1);

        let userId;

        if (!existingUser || existingUser.length === 0) {
          // Create new user with dummy password
          const { data: newUser, error } = await supabase
            .from(TABLE)
            .insert([{ name, username: email, email, password: "google-oauth", profile_pic: picture }])
            .select();

          if (error) throw new Error(error.message);
          userId = newUser[0].id;
        } else {
          userId = existingUser[0].id;
        }

        localStorage.setItem("userid", userId);
        localStorage.setItem("user_id", userId);

        window.location.href = `dashboard.html?authentication=${userId}`;
      } catch (err) {
        alert("Google login error: " + err.message);
        console.error(err);
      }
    },
  });

  client.requestCode();
});
