# FavURL バグ調査レポート

調査日時: 2025-10-21
調査範囲: FavURL Chrome Extension全体

## 重大なバグ (Critical)

### 1. グループ削除時にURLが削除される問題
**ファイル**: `popup/popup.js:948-999`
**重要度**: 🔴 Critical

**問題の説明**:
- グループを削除すると、そのグループ内のURLも全て削除されます（979行）
- しかし、`moveURLsToDefaultGroup`関数（1003-1016行）が実装されているのに呼び出されていません
- 確認メッセージでは「This will also delete X bookmarks」と表示されますが、一般的なUX設計では、グループを削除してもURLはデフォルトグループ（Ungrouped）に移動されるべきです

**影響**:
- ユーザーがグループを削除すると、意図せずにブックマークが失われる可能性があります
- データ損失の重大なリスク

**修正方法**:
```javascript
// popup.js:948-999のdeleteGroup関数を修正
async deleteGroup(groupId) {
    try {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) {
            this.showError('Group not found');
            return;
        }

        if (!this.canDeleteGroup(groupId)) {
            this.showError('Cannot delete this group. It is protected.');
            return;
        }

        const urlsInGroup = this.urls.filter(u => u.groupId === groupId);
        const urlCount = urlsInGroup.length;

        // 修正: URLを削除するのではなく、デフォルトグループに移動
        const confirmMessage = urlCount > 0
            ? `Are you sure you want to delete the group "${group.name}"? ${urlCount} bookmark${urlCount !== 1 ? 's' : ''} will be moved to "Ungrouped".`
            : `Are you sure you want to delete the group "${group.name}"?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        this.showLoading('Deleting group...');

        // 修正: URLをデフォルトグループに移動
        this.moveURLsToDefaultGroup(groupId);

        // Remove the group
        this.groups = this.groups.filter(g => g.id !== groupId);

        await this.saveData();
        this.renderURLs();

        this.showMessage(`Group "${group.name}" deleted. ${urlCount} bookmark${urlCount !== 1 ? 's' : ''} moved to Ungrouped.`);
        this.hideLoading();

    } catch (error) {
        console.error('Error deleting group:', error);
        this.showError(error.message || 'Failed to delete group');
        this.hideLoading();
    }
}
```

---

### 2. 未実装関数の呼び出し
**ファイル**: `popup/popup.js:2075, 2123`
**重要度**: 🔴 Critical

**問題の説明**:
- `FavURLUtils.moveURLBetweenStorageKeys`が呼び出されていますが、この関数は`utils/shared.js`に実装されていません
- try-catchで囲まれているため、エラーが発生してもフォールバックで`saveData()`が呼ばれますが、毎回エラーが発生してパフォーマンスに影響します

**該当コード**:
```javascript
// popup.js:2073-2080
try {
    await FavURLUtils.moveURLBetweenStorageKeys(urlId, fromGroupId, targetGroup.id, this.groups.map(g => g.toJSON()));
} catch (storageError) {
    console.warn('Optimized storage move failed, falling back to full save:', storageError);
    await this.saveData();
}
```

**影響**:
- 常にエラーが発生し、フォールバック処理が実行されます
- パフォーマンスの低下とコンソールに不要な警告が表示されます

**修正方法**:
Option 1: 未実装関数を削除し、常に`saveData()`を使用
```javascript
// popup.js:2073-2080を以下に置き換え
await this.saveData();
```

Option 2: `moveURLBetweenStorageKeys`関数を実装
```javascript
// utils/shared.jsに追加
async function moveURLBetweenStorageKeys(urlId, fromGroupId, toGroupId, groups) {
    // 実装が必要
    // 注: 現在のストレージ構造では、グループIDではなくURL単位でキーが割り当てられているため、
    // この最適化は意味がない可能性があります
}
```

---

### 3. 未実装関数の呼び出し（レガシーマイグレーション）
**ファイル**: `popup/popup.js:575`
**重要度**: 🟡 High

**問題の説明**:
- `FavURLUtils.saveURLsToStorage`が呼び出されていますが、この関数は実装されていません
- レガシーストレージからの移行機能が動作しません

**影響**:
- 古いバージョンからのアップグレード時にマイグレーションが失敗する可能性があります

**修正方法**:
この関数が本当に必要かどうか確認し、不要であれば`migrateLegacyStorageToNewStructure`関数自体を削除するか、`StorageManager.saveDataToStorage`を使用するように修正してください。

---

## 中程度のバグ (Medium)

### 4. Favicon取得の問題
**ファイル**: `utils/shared.js:53-73`
**重要度**: 🟡 Medium

**問題の説明**:
- `fetchDirectFavicon`関数で`mode: 'no-cors'`を使用していますが、これだとレスポンスの状態を確認できません
- 常にURLを返していますが、実際にfaviconが存在するか確認できません
- コメントにも「For no-cors mode, we can't check response.ok」と書かれています

**該当コード**:
```javascript
// utils/shared.js:53-73
async function fetchDirectFavicon(url) {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const faviconUrl = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;

        const response = await fetch(faviconUrl, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        });

        // For no-cors mode, we can't check response.ok
        return faviconUrl;
    } catch (error) {
        console.debug('Failed to fetch direct favicon:', error);
        return null;
    }
}
```

**影響**:
- 存在しないfaviconのURLを返す可能性があります
- 画像の読み込みエラーが増える可能性があります

**修正方法**:
現在の実装は実際には妥当です。`no-cors`モードを使用しているため、レスポンスの詳細を確認できませんが、画像の`onerror`イベントでフォールバック処理が行われています。ただし、コメントを改善するか、別のアプローチを検討してください。

---

### 5. onerrorハンドラーの上書き
**ファイル**: `utils/shared.js:80-94`
**重要度**: 🟡 Medium

**問題の説明**:
- `updateFaviconAsync`関数で`imgElement.onerror`を設定していますが、既存のonerrorハンドラーを上書きする可能性があります

**該当コード**:
```javascript
// utils/shared.js:80-94
async function updateFaviconAsync(imgElement, url) {
    const directFavicon = await fetchDirectFavicon(url);
    if (directFavicon && imgElement) {
        const originalSrc = imgElement.src;
        imgElement.src = directFavicon;

        // 既存のonerrorハンドラーを上書きする可能性がある
        imgElement.onerror = () => {
            imgElement.src = originalSrc;
        };
    }
}
```

**影響**:
- HTMLで定義されたonerrorハンドラー（例：`popup.js:807`）が上書きされる可能性があります
- ただし、実際のコードでは`onerror`属性ではなく`addEventListener`を使用しているため、問題は発生しない可能性があります

**修正方法**:
```javascript
async function updateFaviconAsync(imgElement, url) {
    const directFavicon = await fetchDirectFavicon(url);
    if (directFavicon && imgElement) {
        const originalSrc = imgElement.src;
        imgElement.src = directFavicon;

        // addEventListenerを使用して既存のハンドラーを保持
        const errorHandler = () => {
            imgElement.src = originalSrc;
            imgElement.removeEventListener('error', errorHandler);
        };
        imgElement.addEventListener('error', errorHandler);
    }
}
```

---

## 軽微なバグ / 改善点 (Low)

### 6. URL重複チェックのコンテキスト依存
**ファイル**: `popup/popup.js:1569-1589`
**重要度**: 🟢 Low

**問題の説明**:
- `validateURLInput`関数の重複チェック（1581行）で`document.getElementById('editUrlId')?.value`を使用していますが、これは現在のDOMの状態に依存しています
- より堅牢な方法は、パラメータとして現在のURLのIDを渡すべきです

**該当コード**:
```javascript
// popup.js:1581
} else if (this.urls.some(u => u.url === url && u.id !== document.getElementById('editUrlId')?.value)) {
    errorMessage = 'This URL is already saved';
}
```

**修正方法**:
```javascript
validateURLInput(urlInput, errorElementId = 'urlAddressError', currentUrlId = null) {
    const url = urlInput.value.trim();
    const errorElement = document.getElementById(errorElementId);

    if (!errorElement) return true;

    let errorMessage = '';

    if (!url) {
        errorMessage = 'URL is required';
    } else if (!this.isValidURL(url)) {
        errorMessage = 'Please enter a valid URL (e.g., https://example.com)';
    } else if (this.urls.some(u => u.url === url && u.id !== currentUrlId)) {
        errorMessage = 'This URL is already saved';
    }

    errorElement.textContent = errorMessage;
    urlInput.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');

    return !errorMessage;
}
```

---

### 7. 浮動小数点数の精度（理論的な問題）
**ファイル**: `utils/dragDrop.js:129, 132` と `popup/popup.js:1919, 1922`
**重要度**: 🟢 Low

**問題の説明**:
- ドラッグ&ドロップ時にorderに0.5を加算/減算していますが、頻繁に操作を行うと浮動小数点数の精度の問題が起こる可能性があります
- ただし、正規化処理（`normalizeURLOrdersInGroup`、`normalizeGroupOrders`）があるため、実際には問題にならない可能性が高いです

**影響**:
- 理論的には、何百回もドラッグ&ドロップを繰り返すと、浮動小数点数の精度が失われる可能性があります
- しかし、正規化処理があるため、実際には問題になりません

**修正方法**:
現状の実装で問題ありません。正規化処理が適切に機能しています。

---

## その他の観察事項

### 8. データの部分的欠損への対応
**ファイル**: `utils/storageManager.js:52-112`
**重要度**: 🟢 Info

**観察**:
- `loadDataFromStorage`関数は、`urlCount`までループしてデータを読み込みますが、途中でデータが欠けていてもエラーにはなりません
- 例えば、`url000`は存在するが`url001`が欠けている場合、`url001`は単にスキップされます

**評価**:
- これは実際には適切な動作です。破損したデータがあっても、他のデータは正常に読み込まれます
- ただし、データの整合性を確認するログを追加すると良いでしょう

---

## まとめ

### 優先度別修正リスト

**即座に修正すべき（Critical）:**
1. グループ削除時のURL削除問題（popup.js:948-999）
2. 未実装関数の呼び出し（popup.js:2075, 2123）

**近日中に修正すべき（High）:**
3. 未実装関数の呼び出し - レガシーマイグレーション（popup.js:575）

**時間があれば修正（Medium）:**
4. Favicon取得の問題（shared.js:53-73） - コメント改善
5. onerrorハンドラーの上書き（shared.js:80-94）

**低優先度（Low）:**
6. URL重複チェックのコンテキスト依存（popup.js:1569-1589）
7. 浮動小数点数の精度（理論的な問題）

### テスト推奨項目
1. グループ削除機能のテスト（URLが削除されないことを確認）
2. URL移動機能のテスト（グループ間移動）
3. レガシーデータからのマイグレーション

---

## 調査方法
- 静的コード解析
- 関数呼び出しの追跡
- エラーハンドリングの確認
- データフローの分析
