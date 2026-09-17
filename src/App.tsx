import './App.css';
import { GardenCanvas } from './components/GardenCanvas';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🌱 Мой сад</h1>
      </header>
      <main>
        <GardenCanvas />
      </main>
    </div>
  );
}

export default App;