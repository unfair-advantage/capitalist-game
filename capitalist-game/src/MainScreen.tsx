import React, { useState, FormEvent } from 'react';
import './MainScreen.css';

// Types
type CapitalistMood = 'neutral' | 'angry' | 'happy' | 'thinking';

interface IdeaResponse {
  mood: CapitalistMood;
  message: string;
}

export const MainScreen: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [mood, setMood] = useState<CapitalistMood>('neutral');
  const [message, setMessage] = useState('Give me a concept. NOW.');
  const [isLoading, setIsLoading] = useState(false);

  // Mock Backend Call (Replace with actual fetch to your Node backend)
  const evaluateIdea = async (idea: string): Promise<IdeaResponse> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock LLM logic: simple randomizer for demonstration
        const isProfitable = Math.random() > 0.5; 
        resolve({
          mood: isProfitable ? 'happy' : 'angry',
          message: isProfitable 
            ? 'Brilliant! Adding this to the Golden Fund.' 
            : 'Unprofitable idea! Get out of my office!'
        });
      }, 1500);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    setMood('thinking');
    setMessage('Processing...');
    
    try {
      const response = await evaluateIdea(inputText);
      setMood(response.mood);
      setMessage(response.message);
    } catch (error) {
      setMood('angry');
      setMessage('The network failed! Time is money!');
    } finally {
      setIsLoading(false);
      setInputText('');
    }
  };

  // Image resolver function
  const getCapitalistImage = (currentMood: CapitalistMood) => {
    // Replace these with your actual local or hosted assets
    const assets = {
      neutral: 'https://placehold.co/600x400/303030/FFF?text=Capitalist:+Neutral',
      thinking: 'https://placehold.co/600x400/505030/FFF?text=Capitalist:+Thinking',
      angry: 'https://placehold.co/600x400/602020/FFF?text=Capitalist:+Angry',
      happy: 'https://placehold.co/600x400/206020/FFF?text=Capitalist:+Happy',
    };
    return assets[currentMood];
  };

  return (
    <div className="game-container">
      {/* Header */}
      <header className="game-header">
        <button className="icon-button" aria-label="Menu">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="title">Give me ideas</h1>
        <div className="header-spacer"></div> {/* Balances flex layout */}
      </header>

      {/* Main Content */}
      <main className="game-main">
        <div className="message-container" key={message}>
          <div className={`message-bubble ${mood}`}>
            <h2>{message}</h2>
          </div>
        </div>

        <div className="character-container">
          <img 
            src={getCapitalistImage(mood)} 
            alt={`Capitalist looking ${mood}`} 
            className={`character-image ${isLoading ? 'pulsate' : ''}`}
          />
        </div>
      </main>

      {/* Input Area */}
      <form className="input-area" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <input
            type="text"
            className="idea-input"
            placeholder="GIVE ME IDEAS..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <button type="button" className="action-button" disabled={isLoading} aria-label="Voice Input">
          <span className="material-symbols-outlined">mic</span>
        </button>
        <button type="submit" className="action-button primary" disabled={isLoading || !inputText.trim()} aria-label="Submit Idea">
          <span className="material-symbols-outlined">send</span>
        </button>
      </form>
    </div>
  );
};