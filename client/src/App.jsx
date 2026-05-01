import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import Room from './Room';

function App() {
  return (
    <BrowserRouter>
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
