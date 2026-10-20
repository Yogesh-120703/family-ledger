# Family Ledger — Android app with UPI payment detection

## What changed and why

**Before:** the app was a web app (PWA): plain HTML/CSS/JavaScript, data in browser storage, deployed on Vercel.
A web app cannot read phone notifications. Android only allows that through a native `NotificationListenerService`.

**Now:** the same web code runs inside a native Android app built with **Capacitor 7**. Nothing was rewritten:
`index.html`, `styles.css`, `core.js` and `app.js` are used as they are, and the Vercel web version keeps working
(it simply shows "UPI detection works only in the Android app").

| Part | File | What it does |
|---|---|---|
| Notification reader | `android/.../UpiNotificationListener.java` | Android calls this for each new notification. It ignores every app except the ones ticked in Settings, ignores anything without a ₹/Rs/INR amount, and never stores OTP messages |
| On-phone queue | `android/.../UpiStore.java` | Keeps up to 200 unread payment notifications, drops repeats of the same notification within 10 minutes, and clears everything when detection is turned off |
| Instant alert | `android/.../UpiAlerter.java`, `UpiText.java` | A few seconds after a payment notification, shows Family Ledger's own alert ("₹450 paid to Annapoorna Hotel · tap to add"). Several notifications for one payment update the same alert. `UpiText` uses the same rules as `parseUpi()` in core.js (checked on 19 sample messages) |
| Bridge | `android/.../LedgerNativePlugin.java` | Lets the app check permissions, ask for alert permission, open Android settings, open the review screen when an alert is tapped, turn detection on/off, read and clear the queue, save CSV/backup files to Downloads, and print reports |
| Rules | `core.js` → `parseUpi()` | Decides: outgoing payment / failed / money received / refund / request or reminder / unclear / ignore. Finds the amount (skipping "Avl Bal" figures), payee and the 12-digit UPI reference |
| Screens | `app.js` | Settings → UPI payment detection, the **UPI review** screen, and "Paid with" on expenses |

### How a payment flows (real time, automatic)
1. You pay with Google Pay, PhonePe, Paytm, BHIM or CRED, or your bank sends a debit SMS.
2. The listener keeps the notification straight away (only if it has a ₹ amount; OTPs never).
3. About 8 seconds later (time to collect the bank SMS for the same payment) Family Ledger shows its own alert, even when the app is closed: **"₹100 paid to Ravi Kumar · Family Ledger is adding it to your expenses. Tap to choose a category."**
4. The app adds it the moment it reads the payment (when you tap the alert or open the app; instantly if the app is already open):
   - **Clear outgoing payment** (money sent, single amount found, no similar payment already recorded that day): **added to Expenses automatically** as **Not sorted**. It counts in Total expenses, balance, limits and reports straight away. The app never picks a category.
   - **Unclear** (no amount, more than one amount, or the same amount already recorded that day): goes to the **UPI review** screen to confirm.
   - **Failed, money received, refund/cashback, request or reminder:** never added; listed under Settings → Skipped notifications.
5. **Choosing the category:** tap the alert, or Home → **Needs a category** → tap the payment → Necessary or Lifestyle → category → Save. If a payment was not yours, tap Delete.
6. Settings → **Add payments automatically** (on by default) can be turned off. Then every payment waits on the review screen, as in the earlier version.

### Duplicate protection
- The same UPI reference number is never added twice, and a rejected notification never comes back.
- Android re-posting the same notification is ignored on the phone.
- **One payment, several notifications:** notifications with the same UPI ref, or the same amount within 3 minutes, are combined into **one review card** ("3 notifications for this payment"), so you review and save once. Different UPI refs are never combined. If they really were separate payments, tap **These were separate payments** to split them.
- A notification arriving after its payment was already saved is listed as "Same payment, already saved" under Skipped notifications.
- The same amount from another source 3–10 minutes apart is flagged "may be the same payment" and gets no one-tap save.
- The same amount already recorded that day (for example you typed it manually) is flagged too.

### Check a message
⚙ Settings → UPI payment detection → **Check a message**: paste the text of a real payment notification or bank SMS to see how it is read (payment or not, amount, payee, UPI ref). Nothing is saved. This also works in the web version.

The earlier demo mode has been removed. Any demo entries left from it are deleted automatically the first time the new version opens; real entries are not touched.

### Nothing is made up
- A missing or unclear amount stays empty, and the form will not save until you type it.
- Payee missing: the name field stays empty. The date is the notification's time.
- There is no demo or example data in the app. The automated tests use a stand-in plugin and hand-written sentences, kept only in the test files outside the app.

## Permissions

| Permission | Why | How it is granted |
|---|---|---|
| **Notification access** (`BIND_NOTIFICATION_LISTENER_SERVICE`) | To read payment notifications | Only you can turn it on: Settings → Notifications → Notification access (or "Device & app notifications") → Family Ledger. The app opens that screen for you |
| **Notifications** (`POST_NOTIFICATIONS`, Android 13+) | To show the "₹450 paid… tap to add" alert | Android asks you when you turn on detection, or tap **Turn on** next to "Instant payment alerts". Android 12 and older allow it by default |
| Internet | Loading fonts | Automatic |
| Storage | **Not needed.** CSV and backup files are saved to Downloads using Android's MediaStore (Android 10+) or the app's own folder (Android 9 and below) | — |

No SMS permission is requested. Bank SMS are only seen as notifications posted by your Messages app, and only if you tick "Bank SMS" in Settings (off by default).

## Build the APK without Android Studio (GitHub)
The project includes `.github/workflows/android.yml`. Put the project in a GitHub repository and GitHub builds the APK on its own servers on every push to `main`. Open the repository → **Actions** → latest run → **Artifacts** → `family-ledger-apk`, download it, unzip it, and install `app-debug.apk` on the phone. This is a debug build: fine for your own phone, not for the Play Store.

## Build the APK (on your computer)

Needs: **Node.js 20+**, **Android Studio** (recent, with Android SDK 35 and JDK 17/21, both bundled with Android Studio).

```
cd family-ledger-app
npm install
npm run sync               # copies the web files into www/ and into the Android project
npx cap open android       # opens Android Studio
```
In Android Studio:
- Wait for Gradle sync to finish. It downloads Android build tools the first time.
- **Run ▶** with your phone connected (USB debugging on) to install a debug build, or
- **Build → Generate Signed App Bundle / APK** → APK → create a keystore → release.

**Keep the keystore file and passwords safe.** Every future update must be signed with the same key, or Android will refuse to install it over the old app.

Whenever you change `index.html`, `styles.css`, `core.js` or `app.js`, run `npm run sync` again before building.

## Device testing (please do all of these on a real phone)

1. **Install** the APK and open Family Ledger.
2. **Move your data:** in the web version → Income → **Copy my data**. In the app → ⚙ Settings → Backup and move data → paste → Import. (The app and the web version store data separately.)
3. ⚙ Settings → **UPI payment detection** → **Allow access** → turn on Family Ledger.
   - On **Android 13 or newer**, if the switch is greyed out or you see "Restricted setting": back in the app tap **Open App info** → ⋮ (top right) → **Allow restricted settings** → try again. This happens for apps installed from an APK, not from the Play Store.
4. Turn on **Detect UPI payments**. On Android 13+ allow notifications when asked. Tick your apps, and choose who pays from this phone.
5. **Close Family Ledger.** Make a **small real payment** (₹1 to a family member) with each app you use.
   - Check whether the UPI app showed a notification at all (see Limitations below).
   - Within about 10 seconds a **Family Ledger alert** should appear: "₹1 paid to …".
   - Tap it: the app opens on **UPI review** with the payment.
6. On the review screen, tap **Notification text** and check the amount, payee and UPI ref match what happened. Save it, then check Home and Expenses.
7. **Receive** ₹1 from someone. It should appear under **Skipped notifications** as "Money received", not on the review screen.
8. If you can, test a **failed** payment and a **refund**. Both should be skipped.
9. Turn on **Bank SMS** and make a payment. If the UPI app and the bank both notify, you should get **one** alert and **one** review card saying "2 (or 3) notifications for this payment".
10. Turn detection **off**: unreviewed items clear and nothing new is collected.
11. Restart the phone and make another payment. Detection should keep working (Android restarts the listener itself).
12. Settings → Export CSV / Download backup: the file appears in **Downloads**. Reports → Print / Save PDF opens Android's print screen.

**If something is missed or read wrongly**, copy the text from "Notification text" (or the original notification) and send it to me. The rules in `parseUpi()` can be adjusted to the real wording. They have only been tested against wording I wrote, not real app notifications.

## Limitations (honest list)
- **Some UPI apps don't notify you about payments you make yourself.** They show a success screen in the app instead. In that case there is nothing for Family Ledger to read. Bank debit SMS (tick "Bank SMS") usually cover these.
- **Notification wording differs by app, version and bank, and can change with app updates.** Detection is only as good as the text rules, which have not yet been checked against real notifications.
- **Payments made while the phone is off,** or notifications swiped away before Android delivers them, can be missed. Phone makers with aggressive battery saving (some Xiaomi, Oppo, Vivo and Realme models) may stop the listener. If that happens, set Family Ledger's battery usage to "Unrestricted".
- The alert comes a few seconds after the payment notification. Nothing is saved until you confirm it, by design.
- If you turn off Family Ledger's notifications in Android settings, detection still works, but you only see payments when you open the app.
- The **merchant name** is whatever the notification says (sometimes a UPI ID like `name@okaxis`). You can rename it before saving.
- **Play Store:** Google reviews apps that use notification access. Publishing there needs a privacy policy and a clear in-app explanation. Installing the APK directly avoids this but triggers Android 13's "restricted setting" step.
- **Data is on this phone only.** It doesn't sync with the web version or other phones. Use backup/import to move it.

## Not verified yet
This Android project was written in a workspace without the Android SDK, so it has **not been compiled, installed or run on a phone**. The JavaScript logic is tested (parser rules, review flow, totals, duplicates), and the Java files were checked for syntax errors. Android Studio's first build will do the full check. Send me any build error and I'll fix it.
