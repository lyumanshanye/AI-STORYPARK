import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ChoosePage.css'; // 保存你的CSS样式的文件

function ChoosePage() {
  const navigate = useNavigate(); // 正确地在组件内部使用useNavigate

  // 创建一个用于导航的函数，不需要接受路径作为参数，因为路径已经在函数内指定
  const goToStoryPage1 = () => {
    navigate('/StoryPage1'); // 假设你的路由设置中定义了'/StoryPage1'
  };
  const goToStoryPage2 = () => {
    navigate('/StoryPage2'); // 假设你的路由设置中定义了'/StoryPage2'
  };
  const goToStoryPage3 = () => {
    navigate('/StoryPage3'); // 假设你的路由设置中定义了'/StoryPage3'
  };

  const gobackground = () => {

  };

  return (
    <div className="choose-page">
      <div className="background1" onClick={gobackground}>
        <img src="background1.png" alt="background" />
      </div>
      <div>
        {/* Other content here */}
      </div>

      {/* Button Section */}
      <div className="button-container">
        <button id='buttonstory1' className="buttonstory1" onClick={goToStoryPage1}>
          <img src="story1.png" alt="story1" />
        </button>
        <button id='buttonstory2' className="buttonstory2" onClick={goToStoryPage2}>
          <img src="story2.png" alt="story2" />
        </button>
        <button id='buttonstory3' className="buttonstory3" onClick={goToStoryPage3}>
          <img src="story3.png" alt="story3" />
        </button>
      </div>
    </div>
  );
}


export default ChoosePage;

