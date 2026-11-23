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
2. Enable **Navigation SDK** and **Maps SDK for Android**.
3. Create an API key. Restrict it to those two APIs and to the Android app
   `tz.co.beyondschools.busspike` with your debug SHA-1
   (`cd android && ./gradlew signingReport` after the first prebuild).

**This repo**
```bash
cp .env.example .env        # fill in GOOGLE_MAPS_API_KEY and EXPO_PUBLIC_API_URL
npm install
npx tsc --noEmit
```

## 2. Run it

```bash
# Terminal 1 — test server on your laptop
cd server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — build and install on the tablet (USB debugging on)
npx expo prebuild --platform android --clean
npx expo run:android
```

Set `EXPO_PUBLIC_API_URL` to your laptop's LAN IP (e.g. `http://192.168.1.20:8000`),
not `localhost`. After changing `.env` or `app.config.ts`, re-run both commands.

Before a test ride, edit `TEST_STOPS` in `src/nav/NavScreen.tsx` to two real
stops on a route you can drive.

## 3. Prepare the tablet

These settings decide whether Android kills the app. Write down what you had to change.
They become the setup checklist for every school device.

- [ ] Location permission: **Allow all the time**
- [ ] App info → Battery → **Unrestricted** (not "Optimised")
- [ ] Tecno / Infinix (HiOS/XOS): Phone Master → **Auto-start** on; lock the app in recent apps
- [ ] Notifications allowed (the "Basi linafuatiliwa" notification must stay visible)

## 4. Test checklist

Results come from `http://<laptop-ip>:8000/spike/stats`.

| # | Test | How | Pass when |
|---|------|-----|-----------|
| 1 | Screen-off tracking | Start GPS, lock screen, leave 30 min | No gap over 60 s |
| 2 | Real ride | Ride a full morning route (~90 min), tablet on dashboard | No gap over 60 s; battery drop recorded |
| 3 | App swiped away | Start GPS, swipe app out of recent apps, wait 10 min | Points keep arriving |
| 4 | Phone restarted mid-trip | Restart tablet during tracking | Note what happens (expected: tracking stops — tells us we need a "resume trip" prompt) |
| 5 | Offline queue | Airplane mode, tap "Tukio la majaribio" 5×, wait 5 min, airplane off | All 5 events arrive, each once; GPS points from the offline period arrive too |
| 6 | Duplicate safety | Tap "Tuma sasa" repeatedly on weak signal | Server event count still equals taps |
| 7 | Turn-by-turn | Maelekezo tab → Anza maelekezo, drive to both test stops | Voice + map directions in Swahili or English; arrival recorded at each stop |
| 8 | Reroute | Take a deliberate wrong turn | New route appears without restarting |
| 9 | Navigation + GPS together | Run tests 2 and 7 on the same ride | Both work; note battery and heat |

Record for every test: tablet model, Android version, pass/fail, and anything odd.

## 5. What we decide from the results

- **All pass** → React Native + Expo + Google Navigation SDK is confirmed; start the real app.
- **Gaps in 1–3 on Tecno/Infinix only** → add a device setup checklist and a "signal lost" alert; consider a recommended tablet model.
- **Navigation SDK fails to build or crashes** → try the package's last version for RN 0.87, or wrap the Android SDK in a small native module.
- **Battery drains faster than the trip length allows** → charger in the bus becomes mandatory; reduce GPS rate when parked.
