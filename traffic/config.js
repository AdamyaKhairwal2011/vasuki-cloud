/*!
 * config.js — Supabase connection config for the Tijori traffic dashboard.
 * Values below are pulled from the traffic-tracker CDN script.
 * The anon key is safe to expose client-side — access is controlled via
 * Supabase Row Level Security (RLS) policies on `traffic_manager`, not by
 * hiding this key.
 */
window.TIJORI_CONFIG = {
  SUPABASE_URL: "https://aitckloahlwemlekaour.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA",
  TABLE: "traffic_manager",
  // Key in localStorage that holds the signed-in user's email
  LOCAL_STORAGE_USER_KEY: "vcloud_user",
  // Poll interval for "real-time" refresh, in ms
  POLL_INTERVAL_MS: 15000
};
