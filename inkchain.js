import TelegramBot from 'node-telegram-bot-api';
import Web3 from 'web3';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { v4 as uuidv4 } from 'uuid';
/*import pkg from 'uuid';
const { v4: uuidv4 } = pkg;*/

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const web3Sepolia = new Web3(new Web3.providers.HttpProvider(process.env.SEPOLIA_RPC_URL));
const web3Ink = new Web3(new Web3.providers.HttpProvider(process.env.INK_RPC_URL));

//const senderAddress = process.env.SENDER_ADDRESS;
const senderAddress = '0x' + process.env.SENDER_ADDRESS;
//const privateKey = process.env.PRIVATE_KEY;
const privateKey = '0x' + process.env.PRIVATE_KEY;
const chatId = process.env.CHAT_ID;

bot.onText(/\/start/, (msg) => {
    const options = {
        reply_markup: {
            keyboard: [
                ['Bridge Sepolia ETH > InkChain'],
                ['Bridge InkChain > Sepolia ETH'],
                ['Tx InkChain > Random Wallet'],
                ['Cek Total Transaksi'],
                ['Deploy Token'],
                ['Kirim Token']
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    };
    bot.sendMessage(chatId, 'Pilih opsi:', options);
});

bot.on('message', async (msg) => {
    if (msg.chat.id !== parseInt(chatId)) return;

    if (msg.text === 'Bridge Sepolia ETH > InkChain') {
        bot.sendMessage(chatId, 'Masukkan jumlah yang akan di-bridge:');
        bot.once('message', async (amountMsg) => {
            const amount = parseFloat(amountMsg.text.replace(',', '.')) || 0.01;
            bot.sendMessage(chatId, 'Ingin berapa kali bridge?');
            bot.once('message', async (countMsg) => {
                const count = parseInt(countMsg.text) || 1;
                for (let i = 0; i < count; i++) {
                    await bridgeSepoliaToInk(amount, chatId);
                    const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            });
        });
    } else if (msg.text === 'Bridge InkChain > Sepolia ETH') {
        bot.sendMessage(chatId, 'Masukkan jumlah yang akan di-bridge:');
        bot.once('message', async (amountMsg) => {
            const amount = parseFloat(amountMsg.text.replace(',', '.')) || 0.01;
            bot.sendMessage(chatId, 'Ingin berapa kali bridge?');
            bot.once('message', async (countMsg) => {
                const count = parseInt(countMsg.text) || 1;
                for (let i = 0; i < count; i++) {
                    await bridgeInkToSepolia(amount, chatId);
                    const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            });
        });
    } else if (msg.text === 'Tx InkChain > Random Wallet') {
        bot.sendMessage(chatId, 'Masukkan nama file wallet (contoh: wallets.txt) atau masukkan alamat wallet langsung:');
        bot.once('message', async (inputMsg) => {
            let wallets = [];
            if (fs.existsSync(inputMsg.text)) {
                wallets = fs.readFileSync(inputMsg.text, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
            } else if (web3Ink.utils.isAddress(inputMsg.text)) {
                wallets.push(inputMsg.text);
            } else {
                bot.sendMessage(chatId, 'Alamat wallet tidak valid dan file tidak ditemukan.');
                return;
            }
            bot.sendMessage(chatId, 'Masukkan Jumlah Transaksi (Transfer kecil aja 0.0000001):');
            bot.once('message', async (amountMsg) => {
                const amount = parseFloat(amountMsg.text) || 0.0000001;
                bot.sendMessage(chatId, 'Ingin berapa kali transaksi berulang?');
                bot.once('message', async (countMsg) => {
                    const count = parseInt(countMsg.text) || 1;
                    for (let i = 0; i < count; i++) {
                        for (const wallet of wallets) {
                            await sendEth(wallet, amount, chatId);
                            const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                });
            });
        });
    } else if (msg.text === 'Cek Total Transaksi') {
        await fetchTransactionCount(chatId);
    } else if (msg.text === 'Deploy Token') {
    const contractPath = path.resolve("contracts", "MyToken.sol");
    if (!fs.existsSync(contractPath)) {
        bot.sendMessage(chatId, 'File kontrak MyToken.sol tidak ditemukan.');
        return;
    }

    try {
        const { abi, bytecode } = compileContract(contractPath);

        fs.writeFileSync("MyTokenABI.json", JSON.stringify(abi, null, 2));
        fs.writeFileSync("MyTokenBytecode.txt", bytecode);

        bot.sendMessage(chatId, 'Masukkan nama token (example: WrightL):');
        bot.once('message', async (nameMsg) => {
            const tokenName = nameMsg.text;
            bot.sendMessage(chatId, 'Masukkan simbol token (example: WRL - Maksimal 4 huruf):');
            bot.once('message', async (symbolMsg) => {
                const tokenSymbol = symbolMsg.text;
                bot.sendMessage(chatId, 'Masukkan total supply token (example: 10000000):');
                bot.once('message', async (supplyMsg) => {
                    const totalSupply = parseInt(supplyMsg.text);

                    if (totalSupply > 99999999) {
                        bot.sendMessage(chatId, 'Total supply token tidak boleh lebih dari 99,999,999. Silakan coba lagi.');
                        return;
                    }

                    try {
                        const account = web3Ink.eth.accounts.privateKeyToAccount(privateKey);
                        web3Ink.eth.accounts.wallet.add(account);

                        if (senderAddress.toLowerCase() !== account.address.toLowerCase()) {
                            throw new Error("Alamat pengirim tidak sesuai dengan private key.");
                        }

                        const contract = new web3Ink.eth.Contract(abi);
                        const deployTx = contract.deploy({
                            data: bytecode,
                            arguments: [tokenName, tokenSymbol, totalSupply],
                        });

                        const gasEstimate = await deployTx.estimateGas({ from: senderAddress });
                        const receipt = await deployTx.send({
                            from: senderAddress,
                            gas: gasEstimate,
                        });

                        const deployData = `${receipt.options.address}|${tokenName}\n`;
                        fs.appendFileSync('deploy.txt', deployData, 'utf8');


                        let transferTx;
                        try {
                           const tokenContract = new web3Ink.eth.Contract(abi, receipt.options.address);
                            const amountToSend = web3Ink.utils.toWei(totalSupply.toString());
                            const gasEstimateTransfer = await tokenContract.methods.transfer(senderAddress, amountToSend).estimateGas({ from: senderAddress });
                            transferTx = await tokenContract.methods.transfer(senderAddress, amountToSend).send({
                                from: senderAddress,
                                gas: gasEstimateTransfer,
                            });
                            console.log("Transfer berhasil:", transferTx.transactionHash);

                        } catch (transferError) {
                            console.error("Gagal mengirim token setelah deploy:", transferError);
                            bot.sendMessage(chatId, `Gagal mengirim token setelah deploy: ${transferError.message}`);
                        }


                        let message = `
=====| InkChain-Bot |=====

• Token berhasil dideploy!
• Address: ${receipt.options.address}
• Data disimpan ke file: deploy.txt

${transferTx ? 
`• Token berhasil dikirim ke wallet Anda.
 • TX HASH ID: ${transferTx.transactionHash}
 • Link: https://explorer-sepolia.inkonchain.com/tx/${transferTx.transactionHash}` : 
`• Gagal mengirim token ke alamat Anda.`}

===================================
`;

bot.sendMessage(chatId, message);



                    } catch (deployError) {
                        console.error("Error deploying token:", deployError);
                        bot.sendMessage(chatId, `Error deploying token: ${deployError.message}`);
                    }
                });
            });
        });

    } catch (compileError) {
        console.error("Error compiling contract:", compileError);
        bot.sendMessage(chatId, `Error compiling contract: ${compileError.message}`);
    }
    } else if (msg.text === 'Kirim Token') {
        let deployData = "";
        try {
            deployData = fs.readFileSync("deploy.txt", "utf8");
        } catch (err) {
            bot.sendMessage(chatId, "Belum ada token yang di-deploy.");
            return;
        }

        let tokenEntries = deployData.trim().split('\n').map(entry => {
            const [address, name] = entry.split('|');
            return `Nama: ${name}\nAddress: \`${address}\` _Klik Untuk Menyalin_`;
        });

        const message = `List Deploy Token ERC20 Milik Anda:\n\n${tokenEntries.join('\n\n')}`;
        bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });

        bot.sendMessage(chatId, 'Masukkan alamat kontrak token ERC-20:');
        bot.once('message', async (tokenAddressMsg) => {
            const tokenAddress = tokenAddressMsg.text.trim();

            try {
                if (!web3Ink.utils.isAddress(tokenAddress)) {
                    throw new Error("Alamat token tidak valid.");
                }

                bot.sendMessage(chatId, 'Masukkan nama file wallet (contoh: wallets.txt) atau masukkan alamat wallet langsung:');
                bot.once('message', async (inputMsg) => {
                    let wallets = [];
                    if (fs.existsSync(inputMsg.text)) {
                        wallets = fs.readFileSync(inputMsg.text, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
                    } else if (web3Ink.utils.isAddress(inputMsg.text)) {
                        wallets.push(inputMsg.text);
                    } else {
                        bot.sendMessage(chatId, 'Alamat wallet tidak valid dan file tidak ditemukan.');
                        return;
                    }

                    bot.sendMessage(chatId, 'Masukkan jumlah token yang akan dikirim (Minimal 1 Token):');
                    bot.once('message', async (amountMsg) => {
                    const amount = parseFloat(amountMsg.text);

                    if (isNaN(amount) || amount < 1) {
                        bot.sendMessage(chatId, 'Jumlah token tidak valid. Minimal 1 token harus dimasukkan.');
                        return;
                    }

                        bot.sendMessage(chatId, 'Ingin berapa kali transaksi berulang?');
                        bot.once('message', async (countMsg) => {
                            const count = parseInt(countMsg.text) || 1;
                            const abi = JSON.parse(fs.readFileSync("MyTokenABI.json", "utf8"));
                            const tokenContract = new web3Ink.eth.Contract(abi, tokenAddress);

                            const selectedTokenEntry = deployData.trim().split('\n').find(entry => entry.startsWith(tokenAddress));
                            const tokenName = selectedTokenEntry ? selectedTokenEntry.split('|')[1] : "Token Tidak Dikenal";

                            for (let i = 0; i < count; i++) {
                                for (const wallet of wallets) {
                                    try {
                                        const account = web3Ink.eth.accounts.privateKeyToAccount(privateKey);
                                        web3Ink.eth.accounts.wallet.add(account);
                                        if (senderAddress.toLowerCase() !== account.address.toLowerCase()) {
                                            throw new Error("Alamat pengirim tidak sesuai dengan private key.");
                                        }

                                        const gasEstimate = await tokenContract.methods.transfer(wallet, web3Ink.utils.toWei(amount.toString())).estimateGas({ from: senderAddress });
                                        const tx = await tokenContract.methods.transfer(wallet, web3Ink.utils.toWei(amount.toString())).send({
                                            from: senderAddress,
                                            gas: gasEstimate
                                        });

                                        bot.sendMessage(chatId, `
=====| Transaksi Token ERC20 |=====

• Nama Token: ${tokenName}
• Jumlah Token Dikirim: ${amount} ${tokenName}
• Wallet Penerima: ${wallet}
• TX HASH: ${tx.transactionHash}
• Link Transaksi: https://explorer-sepolia.inkonchain.com/tx/${tx.transactionHash}

===================================
                                    `, { parse_mode: 'Markdown' });

                                    } catch (error) {
                                        bot.sendMessage(chatId, `Gagal mengirim token ke ${wallet}: ${error.message}`);
                                    }
                                    const delay = Math.floor(Math.random() * (15000 - 11000 + 1) + 11000);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                }
                            }
                        });
                    });
                });
            } catch (error) {
                bot.sendMessage(chatId, `Error: ${error.message}`);
            }
        });
    }
});

function compileContract(contractPath) {
    const contractSource = fs.readFileSync(contractPath, "utf8");
    const input = {
        language: "Solidity",
        sources: {
            [path.basename(contractPath)]: {
                content: contractSource,
            },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        output.errors.forEach((err) => {
            console.error(err.formattedMessage);
        });
        throw new Error("Compilation failed.");
    }

    const contractName = Object.keys(output.contracts[path.basename(contractPath)])[0];
    const abi = output.contracts[path.basename(contractPath)][contractName].abi;
    const bytecode = output.contracts[path.basename(contractPath)][contractName].evm.bytecode.object;

    return { abi, bytecode };
}

function generateUuid() {
    return uuidv4();
}

function generateMixpanelCookieValue() {
    const distinct_id = generateUuid();
    const device_id = generateUuid().replace(/-/g, '');
    return {
        distinct_id: distinct_id,
        $device_id: device_id,
        $initial_referrer: '$direct',
        $initial_referring_domain: '$direct',
        'Chain id': '325000',
        Environment: 'Prod',
        Authorized: false,
        'Viewport width': 433,
        'Viewport height': 656,
        Language: 'id-ID',
        'Device type': 'Browser',
        'User id': distinct_id,
        $user_id: distinct_id,
    };
}



function generateCookies() {
    const uuidValue = generateUuid();
    const mixpanelValue = generateMixpanelCookieValue();
    const mixpanelHash = uuidValue.slice(0, 10);
    const mixpanelCookieName = `mp_${mixpanelHash}_mixpanel`;
    const cookieString = [
        `chakra-ui-color-mode=dark`,
        `uuid=${uuidValue}`,
        `chakra-ui-color-mode-hex=#101112`,
        `indexing_alert=false`,
        `nav_bar_collapsed=true`,
        `adblock_detected=false`,
        `${mixpanelCookieName}=${encodeURIComponent(JSON.stringify(mixpanelValue))}`,
    ].join('; ');
    return cookieString;
}

async function fetchTransactionCount(chatId) {
    const cookies = generateCookies();
    const headers = {
        'accept': '*/*',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'cookie': cookies,
        'Referer': `https://explorer-sepolia.inkonchain.com/address/${senderAddress}?tab=txs`,
        'Referrer-Policy': 'origin-when-cross-origin'
    };
    const url = `https://explorer-sepolia.inkonchain.com/api/v2/addresses/${senderAddress}/counters`;
    try {
        const response = await axios.get(url, { headers });
        const transactionCount = response.data.transactions_count || 'N/A';
        bot.sendMessage(chatId, `
=====| Cek Total Transaksi |=====

• Alamat Pengguna: ${senderAddress}
• Total Transaksi: ${transactionCount}
• Status: ${transactionCount > 0 ? 'Ada Transaksi' : 'Belum Ada Transaksi'}
• Link Jumlah Transaksi: https://explorer-sepolia.inkonchain.com/address/${senderAddress}?tab=txs

===================================
`);

} catch (error) {
        bot.sendMessage(chatId, `InkChain-Bot:\nError fetching transaction count: ${error.message}`);
    }
}

async function bridgeSepoliaToInk(amount, chatId) {
    try {
        const nonce = await web3Sepolia.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3Sepolia.eth.getGasPrice();
        const amountString = amount.toFixed(18); 
        const tx = {
            from: senderAddress,
            to: senderAddress,
            //value: web3Sepolia.utils.toWei(amount.toString(), 'ether'),
            value: web3Ink.utils.toWei(amountString, 'ether'),
            gas: 21000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 11155111,
        };
        const signedTx = await web3Sepolia.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3Sepolia.eth.sendSignedTransaction(signedTx.rawTransaction);
        bot.sendMessage(chatId, `
=====| Bridge Sepolia ETH > InkChain |=====

• Transaksi Bridge Berhasil!
• Jumlah Sepolia yang Dibridge: ${amountString}
• TX HASH: ${receipt.transactionHash}
• Link Transaksi: https://sepolia.etherscan.io/tx/${receipt.transactionHash}

===================================
`);


    } catch (error) {
        bot.sendMessage(chatId, `InkChain-Bot:\nTerjadi kesalahan saat proses bridge: ${error.message}`);
    }
}

async function bridgeInkToSepolia(amount, chatId) {
    try {
        const nonce = await web3Ink.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3Ink.eth.getGasPrice();
        const amountString = amount.toFixed(18);
        const tx = {
            from: senderAddress,
            to: senderAddress,
            //value: web3Ink.utils.toWei(amount.toString(), 'ether'),
            value: web3Ink.utils.toWei(amountString, 'ether'),
            gas: 21000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 763373,
        };
        const signedTx = await web3Ink.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3Ink.eth.sendSignedTransaction(signedTx.rawTransaction);
        bot.sendMessage(chatId, `
=====| Bridge InkChain > Sepolia ETH |=====

• Proses Bridge Sukses!
• Jumlah Ink yang Dibridge: ${amountString}
• TX HASH: ${receipt.transactionHash}
• Lihat Transaksi di Sepolia: https://explorer-sepolia.inkonchain.com/tx/${receipt.transactionHash}

===================================
`);

    } catch (error) {
        bot.sendMessage(chatId, `InkChain-Bot:\nTerjadi kesalahan saat proses bridge: ${error.message}`);
    }
}

async function sendEth(toAddress, amount, chatId) {
    try {
        const nonce = await web3Ink.eth.getTransactionCount(senderAddress);
        const gasPrice = await web3Ink.eth.getGasPrice();
        
        //const amountFormatted = web3Ink.utils.toWei(amount.toFixed(10).toString(), 'ether');
        const amountString = amount.toFixed(18);
        const tx = {
            from: senderAddress,
            to: toAddress,
            //value: amountFormatted,
            value: web3Ink.utils.toWei(amountString, 'ether'),
            gas: 21000,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 763373,
        };

        const signedTx = await web3Ink.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3Ink.eth.sendSignedTransaction(signedTx.rawTransaction);
        bot.sendMessage(chatId, `
=====| Transaksi InkChain > Random Wallet |=====

• Transaksi Berhasil Terkirim!
• Jumlah Ink yang Dikirim: ${amountString}
• Ke Wallet: ${toAddress}
• TX HASH: ${receipt.transactionHash}
• Lihat Detail Transaksi: https://explorer-sepolia.inkonchain.com/tx/${receipt.transactionHash}

===================================
`);

    } catch (error) {
        bot.sendMessage(chatId, `InkChain-Bot:\nTerjadi kesalahan saat mengirim transaksi ke ${toAddress}: ${error.message}`);
    }
}
