// App.js
import React from 'react';
import StoryPage1 from './StoryPage1'; // 确保路径正确
// import StoryPage2 from './StoryPage2';
// import StoryPage3 from './StoryPage3';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ChoosePage from './Choosepage';

function App() {
  return (
    <Router>
    <Routes>
      <Route path="/" element={<ChoosePage />} />
      <Route path="/StoryPage1" element={<StoryPage1 />} />
      {/* <Route path="/StoryPage2" element={<StoryPage2 />} />
      <Route path="/StoryPage3" element={<StoryPage3 />} /> */}
      <Route path="/choose" element={<ChoosePage />} />
    </Routes>
    </Router>
  );
}

export default App;