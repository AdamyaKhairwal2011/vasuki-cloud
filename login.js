import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const SUPABASE_URL = "https://aitckloahlwemlekaour.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE = "users";

const email = document.querySelector("#email");
const password = document.querySelector("#password");
const loginBtn = document.querySelector("#loginBtn");
const googleLoginBtn = document.querySelector("#googleLoginBtn");


if (localStorage.getItem("userid") !== null && localStorage.getItem("userid") !== "null" ) {
  let org_mpin = localStorage.getItem("mpin");
  let mpin_by_user = prompt("Enter your MPIN to continue:");
  if (org_mpin === mpin_by_user) {
    window.location.href = `dashboard.html?authentication=${localStorage.getItem("userid")}`;
  } else {
    alert("Incorrect MPIN. Please login again.");
    localStorage.removeItem("userid");
    localStorage.removeItem("user_id");
    localStorage.removeItem("mpin");
  }
}


// --------------------------------------
// NORMAL LOGIN
// --------------------------------------
loginBtn.addEventListener("click", async () => {
  if (!email.value || !password.value) {
    alert("Please fill all fields");
    return;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("username", email.value.toLowerCase())
    .eq("password", password.value);

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

  emailjs.init("Ae9XqjI_uBljtl5-b"); // PUBLIC KEY ONLY

  emailjs.send("service_g88cjcm", "template_v8iwope", {
      email: email.value.toLowerCase()
  })
  .then((res) => {
      let mpin_add = prompt("Login successful! Please set a 4-digit MPIN for quicker access next time:");
      localStorage.setItem("mpin", mpin_add);
      window.location.href = `dashboard.html?authentication=${user.id}`;
  })
  .catch((err) => {
      alert("Error:", err);
  });

});


// ----------------------------------------------------
// GOOGLE LOGIN — DIRECT initCodeClient (SAFE)
// ----------------------------------------------------
googleLoginBtn.addEventListener("click", () => {
  const client = google.accounts.oauth2.initCodeClient({
    client_id:
      "600593339063-blt9bcoe1k382f82ri4gd7a2el2bqfv1.apps.googleusercontent.com",
    scope: "openid email profile",
    ux_mode: "popup",
    redirect_uri: "postmessage",

    callback: async (response) => {
      try {
        // 1) Exchange authorization code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: response.code,
            client_id:
              "600593339063-blt9bcoe1k382f82ri4gd7a2el2bqfv1.apps.googleusercontent.com",
            client_secret: "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",
            redirect_uri: "postmessage",
            grant_type: "authorization_code",
          }),
        }).then((r) => r.json());

        if (!tokenRes.access_token) {
          alert("Google login failed. No access token.");
          return;
        }

        // 2) Get userinfo
        const userInfo = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${tokenRes.access_token}` },
          }
        ).then((r) => r.json());

        const googleId = userInfo.sub;
        const name = userInfo.name;
        const email = userInfo.email;
        const picture = userInfo.picture;


        // 3) Check if Google ID exists
        let { data: existingUser } = await supabase
          .from(TABLE)
          .select("*")
          .eq("google_id", googleId)
          .limit(1);

        let userId;

        if (!existingUser || existingUser.length === 0) {
          // 4) User not found → check by email
          let { data: emailUser } = await supabase
            .from(TABLE)
            .select("*")
            .eq("username", email.toLowerCase())
            .limit(1);

          if (emailUser && emailUser.length > 0) {
            // user exists but no google_id → attach google account
            await supabase
              .from(TABLE)
              .update({ google_id: googleId })
              .eq("id", emailUser[0].id);

            userId = emailUser[0].id;
          } else {
            // 5) Create brand new Google user
            const { data: newUser, error } = await supabase
              .from(TABLE)
              .insert([
                {
                  name,
                  username: email.toLowerCase(),
                  email,
                  google_id: googleId,
                  profile_pic: picture,
                  password: "google-oauth", // dummy
                },
              ])
              .select();

            if (error) {
              alert("Google signup failed: " + error.message);
              return;
            }

            userId = newUser[0].id;
          }
        } else {
          userId = existingUser[0].id;
        }

        // 6) Save and redirect
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




