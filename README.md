# Bus Spike

One-week test app for the BeyondSchools bus app. It answers one question before
we build the real thing: **will background GPS, Google turn-by-turn and the
offline queue work on the cheap Android tablets we'll actually use?**

## 1. One-time setup

**On your laptop**
- Node 20+, JDK 17, Android Studio (for the Android SDK and `adb`).
- Python 3.11+ for the test server.

**Google Cloud**
1. Create a project and attach billing (the first 1,000 navigation destinations a month are free).
2. Enable **Navigation SDK** and **Maps SDK for Android**. Also enable
   **Routes API** — it supplies the blue road-following polyline. Directions API
   is legacy and is not offered on new projects; the app does not call it. If
   Routes is unavailable, no fake road line is drawn and the sheet says
   "Njia ya barabara haipatikani".
3. Create an API key. Restrict it to those APIs and to the Android app
   `tz.co.beyondschools.busspike` with your debug SHA-1
   (`cd android && ./gradlew signingReport` after the first prebuild). The same
   package/SHA-1 are repeated as `X-Android-*` headers in
   `src/nav/roadRoute.ts` so the REST calls survive the restriction; update them
   when you switch to a release keystore.

**This repo**
```bash
cp .env.example .env        # fill in GOOGLE_MAPS_API_KEY, EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and EXPO_PUBLIC_API_URL
npm install
npx tsc --noEmit
```

## 2. Run it

```bash
# Terminal 1 — test server on your laptop
cd server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001

# Terminal 2 — build and install on the tablet (USB debugging on)
npx expo prebuild --platform android --clean
npm run android
```

Use `npm run android` on Windows. `scripts/run-android.ps1` sets the JDK, Android
SDK and Gradle memory variables for each build; edit it if your machine differs.

Set `EXPO_PUBLIC_API_URL` to your laptop's current LAN IP (e.g. `http://192.168.100.9:8001`),
not `localhost`. After changing `.env` or `app.config.ts`, re-run both commands.

### Driver flow (local spike)

The app now starts at **sign in** instead of going straight to the map:

1. `SignInScreen` — phone number + password. Local validation only: a Tanzanian
   number (`0712345678` or `+255712345678`) and a password of at least 6
   characters. No network call, no token storage — this is replaced by the real
   API later.
2. `AssignmentScreen` — confirms **Njia ya Mbezi**, **20 wanafunzi**, the
   vehicle (**T 123 ABC · Coaster**), the direction (`Vituo vya nyumbani →
   Shule` for Asubuhi, `Shule → Vituo vya nyumbani` for Jioni), and lets the
   driver choose the session. The plate and type also appear in the drive-mode
   banner.
3. `NavScreen` — drive mode with session-specific confirmations:

   - **Asubuhi (pickup):** at each pickup the driver marks each student
     **Amepanda** or **Hayupo** (with the parent's report). "Endelea safari"
     stays locked until everyone at that stop is accounted for. The route ends
     at the separate **Shule** stop, where each boarded student is marked
     **Amefika shuleni** during the seat check.
   - **Jioni (drop-off):** every student starts on the bus at the school. At
     each registered drop point the sheet asks **Nani amempokea?** — the driver
     confirms **Amepokelewa** against the guardian's name, or **Atabaki** when
     no authorised guardian is present.
   - At the last stop, **Thibitisha na funga safari** opens a final summary
     (`TripClose`). It lists anyone still unconfirmed and only lets the driver
     close the trip once all students are accounted for.

   The expanded sheet keeps **GPS na foleni**, **Njia yote**, the full manifest,
   the route timeline and **Badilisha safari** (returns to step 2).

4. **GPS na foleni** remains a temporary panel opened from drive mode.

`src/auth/session.ts` holds the fake login and the `TripContext` shape. Replace
`signInLocal()` with the real auth call when the backend is ready.
`src/nav/tripFlow.ts` owns the shared route/progress rules used by the sheet and
the close screen.

### Demo roster and drop points

`src/data/dropPoints.ts` contains **20 students, each with a different drop
point** along the Njia ya Mbezi route. These are sample coordinates. The map
draws all 20 as normal blue Google-style circles, highlights the next one with
a blue halo, and draws one continuous blue polyline through every remaining
stop via the Routes API (the current replacement for Directions API). The
request sends all stops as `intermediates`, so the path snaps to real roads in
visit order. Foreground location is requested when drive mode opens; before the
first GPS fix the line starts at the active stop, so the route is never reduced
to isolated dots. Tapping a circle opens that stop in the sheet; the route
timeline lets the driver change the active stop deliberately. Replace this one
file with the real roster/API later.

### Phone and tablet layout

Tablets (width ≥ 700 dp) show the map beside a 340 dp stop panel. Phones give
the map the whole screen and use a swipeable bottom sheet: drag the handle up
for the student list, queue and guidance controls. Map controls sit in a
semi-transparent bar on the right edge so they don't cover the route. Google
maps use their normal colours here — buildings stay visible; only noisy POI and
transit labels are hidden. The app shell pads itself with Android's status-bar
height and a small bottom inset, so tabs and map badges never sit under the
notification bar or gesture bar.

## 3. Prepare the tablet

These settings decide whether Android kills the app. Write down what you had to change.
They become the setup checklist for every school device.

- [ ] Location permission: **Allow all the time**
- [ ] App info → Battery → **Unrestricted** (not "Optimised")
- [ ] Tecno / Infinix (HiOS/XOS): Phone Master → **Auto-start** on; lock the app in recent apps
- [ ] Notifications allowed (the "Basi linafuatiliwa" notification must stay visible)

## 4. Test checklist

Results come from `http://<laptop-ip>:8001/spike/stats`.

| # | Test | How | Pass when |
|---|------|-----|-----------|
| 1 | Screen-off tracking | Start GPS, lock screen, leave 30 min | No gap over 60 s |
| 2 | Real ride | Ride a full morning route (~90 min), tablet on dashboard | No gap over 60 s; battery drop recorded |
| 3 | App swiped away | Start GPS, swipe app out of recent apps, wait 10 min | Points keep arriving |
| 4 | Phone restarted mid-trip | Restart tablet during tracking | Note what happens (expected: tracking stops — tells us we need a "resume trip" prompt) |
| 5 | Offline queue | Airplane mode, tap "Tukio la majaribio" 5×, wait 5 min, airplane off | All 5 events arrive, each once; GPS points from the offline period arrive too |
| 6 | Duplicate safety | Tap "Tuma sasa" repeatedly on weak signal | Server event count still equals taps |
| 7 | Turn-by-turn | Ramani ya vituo → Maelekezo, drive to the first stops | Voice + map directions in Swahili or English; arrival recorded at each stop |
| 8 | Reroute | Take a deliberate wrong turn | New route appears without restarting |
| 9 | Navigation + GPS together | Run tests 2 and 7 on the same ride | Both work; note battery and heat |

Record for every test: tablet model, Android version, pass/fail, and anything odd.

## 5. What we decide from the results

- **All pass** → React Native + Expo + Google Navigation SDK is confirmed; start the real app.
- **Gaps in 1–3 on Tecno/Infinix only** → add a device setup checklist and a "signal lost" alert; consider a recommended tablet model.
- **Navigation SDK fails to build or crashes** → try the package's last version for RN 0.87, or wrap the Android SDK in a small native module.
- **Battery drains faster than the trip length allows** → charger in the bus becomes mandatory; reduce GPS rate when parked.
