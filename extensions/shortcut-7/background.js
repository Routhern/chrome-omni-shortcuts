chrome.action.onClicked.addListener(() => {
    const targetUrl = "https://www.naver.com/"; // 열고자 하는 URL
    chrome.tabs.update({ url: targetUrl }); // 현재 탭의 URL을 변경
    chrome.runtime.reload(); // 확장 프로그램 새로고침
  });