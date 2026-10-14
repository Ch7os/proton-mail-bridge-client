# Install without a terminal

For someone who uses Proton Mail and Claude Desktop and does not want to touch a command line. About ten minutes. Nothing here sends mail or changes your mailbox until you ask.

## What you need

1. **Proton Mail Bridge**, Proton's own small app that runs on your computer ([download](https://proton.me/mail/bridge)). This tool talks to your mail through it, so your mail never goes to a third party.
2. **Claude Desktop**.
3. Your **Proton address** and the **Bridge password**.

## Steps

1. **Install Bridge and sign in with your Proton account.** Leave it running (it sits in the menu bar or system tray).
2. **Copy the Bridge password.** In the Bridge app open your account and copy the password it shows for your mailbox (the label is *Copy password* or similar; it varies by Bridge version). This is **not** your Proton password: Bridge makes a separate one for apps on this computer.
3. **Download the file for your computer** from the [latest release](https://github.com/googlarz/proton-mail-bridge-client/releases/latest). The name ends in `.mcpb`:

   | Your computer | File |
   |---|---|
   | Mac with an Apple chip (M1, M2, M3 …): Apple menu → *About This Mac* shows "Chip: Apple M…" | `…-darwin-arm64.mcpb` |
   | Mac with an Intel chip | `…-darwin-x64.mcpb` |
   | Windows | `…-win32-x64.mcpb` |
   | Linux | `…-linux-x64.mcpb` (or `…-linux-arm64.mcpb` on ARM) |

4. **Open the file.** Claude Desktop asks for your Proton address and the Bridge password. Leave the other settings as they are; the defaults match a standard Bridge install.
5. **For your first try, tick "read-only"** in those settings. Claude can then search and read your mail but cannot send, draft, move or delete anything. You can switch it off later. (If you configure by hand: `PROTONMAIL_MODE=read-only`, see the [README](../README.md#one-switch-protonmail_mode).)
6. **Check it works.** Ask Claude: *"Run the Proton Mail doctor."* It checks that Bridge is reachable and your password is right, and says what to fix if not.

## What to ask first

- *"Give me a brief of my mail: what needs me today and what I am waiting on."*
- *"Who is waiting for a reply from me?"*
- *"Prepare me for a call with anna@example.com."*

If your Claude Desktop lists the server's ready-made workflows (MCP prompts), these exist there too under the names *Morning brief*, *Who is waiting on me*, *Waiting on others*, *Prepare for a meeting*, *Answer calendar invitations*, *Clean up newsletters* and *Draft replies*. Where they appear depends on the Claude Desktop version.

## If it does not work

| What you see | Likely cause | What to do |
|---|---|---|
| The doctor says Bridge is unreachable (`bridge_unreachable`) | Bridge is not running, or it uses other ports | Start Bridge and wait until it shows you as signed in. If you changed its ports, set the same ones in the extension settings. |
| The doctor says authentication failed (`authentication_failed`) | You entered your Proton password, or an old Bridge password | Copy the password from the Bridge app again (step 2) and enter it in the extension settings. |
| Claude does not show any Proton Mail tools | Claude Desktop was not fully restarted after setup | Quit it completely (Cmd+Q on a Mac, not just close the window) and open it again. |

Still stuck? Open an [issue](https://github.com/googlarz/proton-mail-bridge-client/issues) and paste the doctor's output. Read it first and remove anything private; please do not paste mail content or passwords.
