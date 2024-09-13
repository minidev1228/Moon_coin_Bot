const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');

dotenv.config();

// Replace 'YOUR_API_TOKEN' with your actual API token
const token = process.env.TOKEN;

const bot = new TelegramBot(token, { polling: true });
const sessionState = {};
const sessionToken = {};

const getScore = async (chatId) => {
    const url = 'https://blue-moon-app-backend.vercel.app/user/getScore';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: chatId })
        });
        const data = await response.json();
        const result = { score: data.score, token: data.token };

        if (data.success == true) {
            return result;
        } else {
            console.log('Server Error in getScore');
            return false;
        }
    } catch (error) {
        console.log('Error in createClean handling', error);
        return false;
    }
}

// Handle '/start' command
bot.onText(/\/start/, async (msg, match) => {
    try {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name || "there";
        const userName = msg.from.username;
        const referralCode = match.input.trim().split('_')[1];
        const isPremium = msg.from.is_premium;

        // const appUrl = `https://bluemoon-mini-app.vercel.app?userId=${chatId}&userName=${encodeURIComponent(userName)}`;
        const appUrl = 'https://blue-moon-mini-app.vercel.app/';

        const welcomeMessage = `Hello, ${firstName}! This is Bluemoon 👋\n\nCan you tap on the coin?\nA little bit later you will be very surprised.\n\nGot friends? Invite them to the game. That’s the way you’ll both earn even more coins together.\n\nThat’s all you need to know to get started.`;

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🕹 Let\'s go', web_app: { url: appUrl } }
                    ],
                    [
                        { text: '🤙 Bluemoon Community', url: 'https://t.me/BluemoonMetaverse' }
                    ],
                    [
                        { text: '🎓 How to play', url: 'https://telegra.ph/Moon-Coin-The-Guide-08-22' }
                    ]
                ]
            }
        };

        console.log(chatId, msg.from.username);
        console.log(isPremium);
        if (referralCode && referralCode != chatId) {
            await fetch('https://blue-moon-app-backend.vercel.app/user/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: chatId, userName:userName })
            });
            await fetch('https://blue-moon-app-backend.vercel.app/user/storeReferral', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: chatId, referrerId: referralCode, isPremium })
            });
        }

        bot.sendMessage(chatId, welcomeMessage, opts);
    } catch (error) {
        console.log("Error occured: ", error.message);
    }
});

bot.onText(/\/createClan/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || "there";
    const data = await getScore(chatId);
    const score = data.score;
    sessionToken[chatId] = data.token;
    if (score < 500000) {
        const appUrl = 'https://blue-moon-mini-app.vercel.app/';
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Earn more coins', web_app: { url: appUrl } }
                    ]
                ]
            }
        };
        bot.sendMessage(chatId, 'Not enough coins to create a clan', opts);
    } else {
        const responseMessage = 'Create clan\n\nSend a nickname of the public channel or chat you want to create\n_example: @telegram_';
        sessionState[chatId] = { command: '/createClan' };
        bot.sendMessage(chatId, responseMessage, { parse_mode: 'Markdown' });
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith('/')) return;

    if (sessionState[chatId]) {
        const { command } = sessionState[chatId];

        // Handle specific command states
        if (command === "/createClan") {
            try {
                const data = await getScore(chatId);
                const score = data.score;
                if (score < 500000) {
                    const appUrl = 'https://blue-moon-mini-app.vercel.app/';
                    // const appUrl = 'https://bluemoon-mini-app.vercel.app';
                    const opts = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Earn more coins', web_app: { url: appUrl } }
                                ]
                            ]
                        }
                    };
                    sessionState[chatId] = null;
                    bot.sendMessage(chatId, 'Not enough coins to create a clan', opts);
                } else {
                    const chatInfo = await bot.getChat(text);
                    if (chatInfo.type === 'channel' || chatInfo.type === 'supergroup') {
                        const channelName = chatInfo.title;
                        const description = chatInfo.description;
                        let profilePictureUrl = null;
                        if (chatInfo.photo) {
                            profilePictureUrl = `https://bluemoon-backend.vercel.app/proxy/${chatInfo.photo.big_file_id}`;
                        }

                        const token = sessionToken[chatId];

                        const response = await fetch('https://blue-moon-app-backend.vercel.app/clan', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                clanName: channelName,
                                profilePictureUrl,
                                description
                            })
                        });

                        const responseData = await response.json();
                        console.log(responseData);
                        if (responseData.success) {
                            const userName = msg.from.first_name || "there";
                            // const appUrl = 'https://bluemoon-mini-app.vercel.app';
                            const appUrl = 'https://blue-moon-mini-app.vercel.app/';
                            const opts = {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Earn more coins', web_app: { url: appUrl } }
                                        ]
                                    ]
                                }
                            };
                            bot.sendMessage(chatId, `Hi, you've created and joined ${channelName} clan 🥳`, opts);
                            sessionState[chatId] = null;
                        } else {
                            bot.sendMessage(chatId, "The clan already exists with the same name");
                        }
                    } else {
                        bot.sendMessage(chatId, "You can only create a clan for a public channel or chat");
                    }
                }
            } catch (error) {
                console.log("Error in CreateClan: ", error);
                bot.sendMessage(chatId, "Specify the address in the format: `@telegram`", { parse_mode: 'Markdown' });
            }
        }
    } else {
    }
});
