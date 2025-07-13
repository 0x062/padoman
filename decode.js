// bot.js - Upaya Terakhir Menggunakan @ensdomains/ensjs

import 'dotenv/config'
import { createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createEnsPublicClient } from '@ensdomains/ensjs'
import { registerName } from '@ensdomains/ensjs/wallet'

// --- PENGATURAN ---
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.PHAROS_RPC_URL;
const newLabel = 'percobaanterakhir'; // Ganti dengan label baru

// --- SETUP JARINGAN & CLIENT ---

// Mendefinisikan chain Pharos Testnet secara manual
const pharosTestnet = defineChain({
  id: 2024, // Chain ID untuk Pharos Testnet
  name: 'Pharos Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'PHRS',
    symbol: 'PHRS',
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Pharosscan', url: 'https://testnet.pharosscan.xyz' },
  },
});

// Membuat wallet client menggunakan viem (diperlukan oleh @ensdomains/ensjs)
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
  account: account,
  chain: pharosTestnet,
  transport: http()
});

// Membuat public client untuk membaca data dari blockchain
const publicClient = createEnsPublicClient({
  chain: pharosTestnet,
  transport: http(),
});

console.log(`[i] Menggunakan wallet: ${account.address}`);

// --- FUNGSI UTAMA ---
async function register(label) {
  const fullName = `${label}.phrs`;
  console.log(`\n🚀 Memulai registrasi untuk '${fullName}'...`);

  try {
    // Library ini akan otomatis melakukan commit, menunggu, dan register.
    console.log("1️⃣ Mengirim permintaan registrasi (Commit + Wait + Register)...");
    const hash = await registerName(walletClient, {
      name: fullName,
      owner: account.address,
      duration: 31536000, // 1 tahun dalam detik
      resolverAddress: '0x9a43dcA1C3BB268546b98eb2AB1401bFc5b58505',
    });
    
    console.log(`[~] Permintaan registrasi terkirim, menunggu konfirmasi...`);
    console.log(`   Tx Hash: ${hash}`);

    // Menunggu transaksi selesai dan mendapatkan receipt-nya
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n🎉 DOMAIN BERHASIL TERDAFTAR!`);
      console.log(`   Lihat di block explorer: https://testnet.pharosscan.xyz/tx/${receipt.transactionHash}`);
    } else {
      console.log(`\n🔥🔥🔥 TRANSAKSI GAGAL DI BLOCKCHAIN 🔥🔥🔥`);
      console.log(`   Status: ${receipt.status}`);
    }

  } catch (err) {
    console.error('\n🔥🔥🔥 GAGAL 🔥🔥🔥');
    console.error(`   - Pesan: ${err.shortMessage || err.message}`);
    console.error('   - Detail:', err);
  }
}

// Menjalankan bot
register(newLabel);
