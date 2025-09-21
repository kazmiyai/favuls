# 拡張機能の保存内容を確認する

1. 拡張機能のpopupウィンドウを表示
2. popupウィンドウを右クリック。「検証」を選択
3. コンソールに以下を入力

  chrome.storage.sync.get(null, (result) => {
      console.log('chrome.storage.sync contents:', result);
  });
  
 pasteが許可されていない場合は、allow pastingをコンソールから入力
 
  