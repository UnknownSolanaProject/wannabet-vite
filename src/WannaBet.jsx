import React, { useState, useEffect, useMemo } from 'react';
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { BN } from 'bn.js';
import idl from './wannabet-idl.json';

// Your deployed program ID
const PROGRAM_ID = new PublicKey('BGTidGEmoagwHVDos8nq5eAEUzDd1R7uDTAcCc5Atq4q');

function WannaBet() {
  const [wallet, setWallet] = useState(null);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [description, setDescription] = useState('');
  const [endTime, setEndTime] = useState('');
  const [initialAmount, setInitialAmount] = useState('');

  // Connection to Solana devnet
  const connection = useMemo(() => new Connection(clusterApiUrl('devnet'), 'confirmed'), []);

  // Get provider
  const getProvider = () => {
    if (!wallet) return null;
    
    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );
    return provider;
  };

  // Get program
  const getProgram = () => {
    const provider = getProvider();
    if (!provider) return null;
    // Cast IDL to proper type for Anchor
    return new Program(idl, provider);
  };

  // Connect Phantom wallet
  const connectWallet = async () => {
    try {
      const { solana } = window;
      
      if (!solana || !solana.isPhantom) {
        alert('Please install Phantom wallet!');
        return;
      }

      const response = await solana.connect();
      console.log('Connected with Public Key:', response.publicKey.toString());
      setWallet(solana);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet');
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    if (wallet) {
      wallet.disconnect();
      setWallet(null);
    }
  };

  // Create a new bet
  const createBet = async (e) => {
    e.preventDefault();
    if (!wallet) {
      alert('Please connect your wallet first!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const program = getProgram();
      if (!program) {
        throw new Error('Program not initialized');
      }

      // Create BN values with explicit checks
      const betId = new BN(Date.now().toString());
      const endTimeDate = new Date(endTime);
      const endTimeUnix = new BN(Math.floor(endTimeDate.getTime() / 1000).toString());
      const amountLamports = new BN(Math.floor(parseFloat(initialAmount) * LAMPORTS_PER_SOL).toString());

      console.log('Creating bet with:', {
        betId: betId.toString(),
        endTime: endTimeUnix.toString(),
        amount: amountLamports.toString()
      });

      // Derive bet PDA
      const [betPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('bet'),
          betId.toArrayLike(Buffer, 'le', 8)
        ],
        program.programId
      );

      console.log('Bet PDA:', betPda.toString());

      await program.methods
        .createBet(betId, description, endTimeUnix, amountLamports)
        .accounts({
          bet: betPda,
          creator: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      alert('Bet created successfully!');
      setDescription('');
      setEndTime('');
      setInitialAmount('');
      await fetchBets();
    } catch (err) {
      console.error('Error creating bet:', err);
      setError('Failed to create bet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Place a bet
  const placeBet = async (betPda, amount, betOnYes) => {
    if (!wallet) {
      alert('Please connect your wallet first!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const program = getProgram();
      const amountLamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

      // Derive user bet PDA
      const [userBetPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from('user_bet'),
          betPda.toBuffer(),
          wallet.publicKey.toBuffer()
        ],
        program.programId
      );

      await program.methods
        .placeBet(amountLamports, betOnYes)
        .accounts({
          bet: betPda,
          userBet: userBetPda,
          user: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      alert('Bet placed successfully!');
      await fetchBets();
    } catch (err) {
      console.error('Error placing bet:', err);
      setError('Failed to place bet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resolve bet (creator only)
  const resolveBet = async (betPda, outcome) => {
    if (!wallet) {
      alert('Please connect your wallet first!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const program = getProgram();

      await program.methods
        .resolveBet(outcome)
        .accounts({
          bet: betPda,
          creator: wallet.publicKey,
        })
        .rpc();

      alert('Bet resolved successfully!');
      await fetchBets();
    } catch (err) {
      console.error('Error resolving bet:', err);
      setError('Failed to resolve bet: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Claim winnings
  const claimWinnings = async (betPda) => {
    if (!wallet) {
      alert('Please connect your wallet first!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const program = getProgram();

      // Derive user bet PDA
      const [userBetPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from('user_bet'),
          betPda.toBuffer(),
          wallet.publicKey.toBuffer()
        ],
        program.programId
      );

      await program.methods
        .claimWinnings()
        .accounts({
          bet: betPda,
          userBet: userBetPda,
          user: wallet.publicKey,
        })
        .rpc();

      alert('Winnings claimed successfully!');
      await fetchBets();
    } catch (err) {
      console.error('Error claiming winnings:', err);
      setError('Failed to claim winnings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all bets (simplified - you'd need to implement proper fetching)
  const fetchBets = async () => {
    if (!wallet) return;

    try {
      const program = getProgram();
      // This is a simplified version - in production you'd want to track bet IDs
      // For now, this is just a placeholder
      const accounts = await program.account.bet.all();
      setBets(accounts);
    } catch (err) {
      console.error('Error fetching bets:', err);
    }
  };

  useEffect(() => {
    if (wallet) {
      fetchBets();
    }
  }, [wallet]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🎲 WannaBet - Decentralized Betting Platform</h1>
      
      {/* Wallet Connection */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        {!wallet ? (
          <button 
            onClick={connectWallet}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#9945FF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Connect Phantom Wallet
          </button>
        ) : (
          <div>
            <p>Connected: {wallet.publicKey.toString().slice(0, 8)}...{wallet.publicKey.toString().slice(-8)}</p>
            <button 
              onClick={disconnectWallet}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Create Bet Form */}
      {wallet && (
        <div style={{ marginBottom: '40px', padding: '20px', border: '2px solid #9945FF', borderRadius: '8px' }}>
          <h2>Create New Bet</h2>
          <form onSubmit={createBet}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Description:</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Will it rain tomorrow?"
                required
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>End Time:</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Initial Amount (SOL):</label>
              <input
                type="number"
                step="0.01"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                placeholder="0.1"
                required
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: loading ? '#ccc' : '#9945FF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Create Bet'}
            </button>
          </form>
        </div>
      )}

      {/* Bets List */}
      {wallet && (
        <div>
          <h2>Active Bets</h2>
          {bets.length === 0 ? (
            <p>No bets found. Create one to get started!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {bets.map((bet, index) => (
                <div key={index} style={{ 
                  padding: '20px', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  backgroundColor: bet.account.resolved ? '#f5f5f5' : 'white'
                }}>
                  <h3>{bet.account.description}</h3>
                  <p><strong>End Time:</strong> {new Date(bet.account.endTime.toNumber() * 1000).toLocaleString()}</p>
                  <p><strong>Total YES:</strong> {(bet.account.totalYes.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                  <p><strong>Total NO:</strong> {(bet.account.totalNo.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL</p>
                  <p><strong>Status:</strong> {bet.account.resolved ? `Resolved (${bet.account.outcome ? 'YES' : 'NO'})` : 'Active'}</p>
                  
                  {!bet.account.resolved && (
                    <div style={{ marginTop: '15px' }}>
                      <button
                        onClick={() => {
                          const amount = prompt('Enter amount in SOL:');
                          if (amount) placeBet(bet.publicKey, amount, true);
                        }}
                        style={{
                          padding: '8px 16px',
                          marginRight: '10px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Bet YES
                      </button>
                      <button
                        onClick={() => {
                          const amount = prompt('Enter amount in SOL:');
                          if (amount) placeBet(bet.publicKey, amount, false);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Bet NO
                      </button>
                    </div>
                  )}

                  {bet.account.creator.toString() === wallet.publicKey.toString() && !bet.account.resolved && (
                    <div style={{ marginTop: '15px' }}>
                      <button
                        onClick={() => resolveBet(bet.publicKey, true)}
                        style={{
                          padding: '8px 16px',
                          marginRight: '10px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Resolve as YES
                      </button>
                      <button
                        onClick={() => resolveBet(bet.publicKey, false)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Resolve as NO
                      </button>
                    </div>
                  )}

                  {bet.account.resolved && (
                    <button
                      onClick={() => claimWinnings(bet.publicKey)}
                      style={{
                        padding: '8px 16px',
                        marginTop: '15px',
                        backgroundColor: '#ffc107',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Claim Winnings
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!wallet && (
        <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
          <h3>Getting Started:</h3>
          <ol>
            <li>Install <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer">Phantom Wallet</a></li>
            <li>Switch to Devnet in Phantom settings</li>
            <li>Get devnet SOL from <a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer">Solana Faucet</a></li>
            <li>Connect your wallet above</li>
            <li>Create your first bet!</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export default WannaBet;
