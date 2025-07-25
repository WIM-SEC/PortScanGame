// IPアドレス生成のためのヘルパー関数
function generateRandomIp() {
    return Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.');
}

document.addEventListener('DOMContentLoaded', () => {
    const portListElement = document.getElementById('port-list');
    const attackerLogElement = document.getElementById('attacker-log');
    const riskLevelProgress = document.getElementById('risk-level');
    const riskValueSpan = document.getElementById('risk-value');
    const usabilityLevelProgress = document.getElementById('usability-level');
    const usabilityValueSpan = document.getElementById('usability-value');
    const messageArea = document.getElementById('message-area');
    const startGameButton = document.getElementById('start-game-button');
    const resetGameButton = document.getElementById('reset-game-button');
    // const gameTimerSpan = document.getElementById('game-timer'); // HTMLから削除済
    // const gameScoreSpan = document.getElementById('game-score'); // HTMLから削除済

    const modal = document.getElementById('port-detail-modal');
    const modalCloseButton = document.querySelector('#port-detail-modal .modal-close-button');
    const modalPortTitle = document.getElementById('modal-port-title');
    const modalPortUsage = document.getElementById('modal-port-usage');
    const modalPortRisk = document.getElementById('modal-port-risk');
    const modalPortVulnerabilitySection = document.getElementById('modal-port-vulnerability-section');
    const modalPortVulnerabilityText = document.getElementById('modal-port-vulnerability-text');
    const modalPortHintSection = document.getElementById('modal-port-hint-section');
    const modalPortHintText = document.getElementById('modal-port-hint-text');

    let gameActive = false;
    let attackLogIntervalId;
    // let score = 0; // スコア概念を削除
    let risk = 100; // サーバーリスクレベル (初期100%)
    let usability = 100; // サービス可用性 (初期100%)

    const MAX_RISK = 100;
    const MIN_USABILITY = 0;

    // ポートデータ
    const allPorts = [
        // Webサイトとメールに必須のポート
        { port: 80, service: 'HTTP', version: 'Apache 2.4.x', type: 'required', usage: 'Webサイトの公開用ポート。ブラウザがWebページを表示する際に利用します。', risk: 'このポートを閉じるとWebサイトにアクセスできなくなります。', vulnerability: null, hint: 'Webサイトの根幹サービスです。閉じないでください。', risk_value: 0, penalty_value: 30 },
        { port: 443, service: 'HTTPS', version: 'Apache 2.4.x', type: 'required', usage: 'SSL/TLS暗号化された安全なWebサイトの公開用ポート。', risk: 'このポートを閉じると安全なWebサイトにアクセスできなくなります。', vulnerability: null, hint: '安全なWebサイトの根幹サービスです。閉じないでください。', risk_value: 0, penalty_value: 30 },
        { port: 25, service: 'SMTP', version: 'Postfix 3.x', type: 'required', usage: 'メールの送信（サーバー間通信）に利用されるポート。', risk: 'このポートを閉じるとメールが送信できなくなります。', vulnerability: null, hint: 'メールの根幹サービスです。閉じないでください。', risk_value: 0, penalty_value: 20 },
        { port: 110, service: 'POP3', version: 'Dovecot 2.x', type: 'required', usage: 'メールの受信に利用されるポート。', risk: 'このポートを閉じるとメールが受信できなくなります。', vulnerability: null, hint: 'メールの根幹サービスです。閉じないでください。', risk_value: 0, penalty_value: 20 },
        { port: 143, service: 'IMAP', version: 'Dovecot 2.x', type: 'required', usage: 'メールの受信（サーバーで管理）に利用されるポート。', risk: 'このポートを閉じるとメールが受信できなくなります。', vulnerability: null, hint: 'メールの根幹サービスです。閉じないでください。', risk_value: 0, penalty_value: 20 },

        // 脆弱なバージョンや設定のあるポート (閉鎖推奨)
        { port: 21, service: 'FTP', version: 'vsftpd 2.3.4', type: 'vulnerable', usage: 'ファイル転送プロトコル。このバージョンには既知のバックドア脆弱性があります。', risk: '高リスク。攻撃者にシステムを完全に掌握される可能性があります。', vulnerability: 'vsftpd 2.3.4にはバックドアが組み込まれている既知の脆弱性があります (CVE-2011-2523)。', hint: '即座に閉鎖するか、より安全なSFTP/FTPSへの移行とアップデートが必要です。', risk_value: 30, penalty_value: 0 },
        { port: 8080, service: 'HTTP', version: 'Apache Tomcat 7.0.x', type: 'vulnerable', usage: 'Webアプリケーションサーバーの管理インターフェースやテスト環境でよく利用されるポート。', risk: '高リスク。管理画面がインターネットに公開されていると、不正ログインや設定改ざんの標的となります。', vulnerability: 'Apache Tomcat 7.0.xには、特定の条件下で情報漏洩やセッション固定攻撃のリスクが報告されています。', hint: '本番環境でこのポートを公開するのは避けるべきです。必要であればアクセス元を制限してください。', risk_value: 25, penalty_value: 0 },

        // 不要だが開いている高リスクポート (閉鎖推奨)
        { port: 23, service: 'Telnet', version: 'Telnetd 0.17', type: 'unnecessary_high_risk', usage: 'リモートからコマンドを実行するためのプロトコル。通信が暗号化されません。', risk: '高リスク。パスワードを含むすべての通信が平文で流れるため、盗聴される危険性があります。', vulnerability: 'Telnet自体に脆弱性があるわけではありませんが、平文通信であるため現在のセキュリティ標準では非推奨です。', hint: 'SSH (22番) の利用に切り替えるべきです。', risk_value: 20, penalty_value: 0 },
        { port: 3389, service: 'RDP', version: 'Microsoft RDP 8.1', type: 'unnecessary_high_risk', usage: 'Windowsのリモートデスクトップ接続プロトコル。', risk: '中リスク。総当たり攻撃や辞書攻撃の標的になりやすく、成功するとサーバーを直接操作されます。', vulnerability: 'RDPのプロトコル自体には脆弱性は少ないですが、認証が不十分だとブルートフォース攻撃に弱いです。', hint: '公開が必要な場合、二段階認証の設定、アクセス元IP制限、VPN経由での利用を強く推奨します。', risk_value: 15, penalty_value: 0 },
        { port: 139, service: 'NetBIOS-ssn', version: 'Samba 4.x', type: 'unnecessary', usage: 'Windowsのファイル共有サービス。', risk: '低リスク。通常、インターネットに公開すべきではありません。内部ネットワークでの利用が前提です。', vulnerability: null, hint: '不要な場合はすぐに閉鎖してください。', risk_value: 5, penalty_value: 0 },
        { port: 445, service: 'SMB', version: 'Windows Server', type: 'unnecessary', usage: 'Windowsのファイル共有サービス。139番と合わせて使われることが多い。', risk: '低リスク。ワーム感染の経路になることもあります。内部ネットワークでの利用が前提です。', vulnerability: null, hint: '不要な場合はすぐに閉鎖してください。', risk_value: 5, penalty_value: 0 },
        { port: 3306, service: 'MySQL', version: 'MySQL 5.7', type: 'unnecessary', usage: 'データベースサーバーの接続ポート。', risk: '中リスク。データベースへの不正アクセスを許す可能性があります。通常は外部に公開しません。', vulnerability: null, hint: 'Webサーバーなどからのみアクセスを許可し、外部からの直接アクセスは禁止してください。', risk_value: 10, penalty_value: 0 },
        { port: 27017, service: 'MongoDB', version: 'MongoDB 2.x', type: 'unnecessary', usage: 'NoSQLデータベースの接続ポート。', risk: '高リスク。認証設定を怠ると、データが誰にでも参照・改変可能になることがあります。', vulnerability: 'MongoDB 2.xはデフォルトで認証が無効になっているケースが多く、無設定で公開すると非常に危険です。', hint: 'データベースのポートは外部に公開せず、アクセス制御を厳格に設定してください。', risk_value: 25, penalty_value: 0 },
        
        // 通常は閉鎖されているべきだが、開いている場合があるその他ポート
        { port: 53, service: 'DNS', version: 'BIND 9.x', type: 'unnecessary', usage: 'ドメイン名解決サービス。権威サーバーでない限り、外部に公開する必要はありません。', risk: '低リスク。DNS増幅攻撃に利用される可能性があります。', vulnerability: null, hint: '不必要な場合は閉鎖、必要な場合はキャッシュポイズニング対策など。', risk_value: 5, penalty_value: 0 },
        { port: 25565, service: 'Minecraft Server', version: 'Forge/Spigot', type: 'unnecessary_game', usage: 'Minecraftゲームサーバー用ポート。', risk: '低リスク。個人利用ゲームサーバーが企業ネットワークで公開されていると、管理が煩雑になります。', vulnerability: null, hint: 'ゲームサーバーはビジネス用途とは関係ありません。閉鎖してください。', risk_value: 5, penalty_value: 0 },
        { port: 6000, service: 'X11', version: 'X.Org', type: 'unnecessary', usage: 'X Window Systemのグラフィック表示。', risk: '高リスク。認証が不十分だと、リモートから画面操作やキーロギングが可能になる危険性があります。', vulnerability: null, hint: 'グラフィカルなリモート操作が必要な場合は、より安全なRDPやVNC over SSHなどを利用すべきです。', risk_value: 15, penalty_value: 0 },
    ];

    let currentOpenPorts = []; // 現在開いているポート (初期状態から減っていく)
    let initialTotalRisk = 0; // ゲーム開始時の合計リスク値

    // 初期化関数
    function initGame() {
        gameActive = false;
        // score = 0; // スコアはHTMLから削除済みなので不要
        risk = 0;
        usability = 100;

        portListElement.innerHTML = '';
        attackerLogElement.innerHTML = '';
        messageArea.textContent = 'ゲーム開始ボタンを押してください。';

        startGameButton.style.display = 'block';
        resetGameButton.style.display = 'none';

        // ポートをランダムに選んで表示
        currentOpenPorts = [];
        const requiredPorts = allPorts.filter(p => p.type === 'required');
        const optionalPorts = allPorts.filter(p => p.type !== 'required');

        // 必須ポートは必ず含める
        requiredPorts.forEach(p => currentOpenPorts.push({ ...p, is_closed: false }));

        // その他ポートからランダムに8-12個選ぶ
        const numToSelect = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
        const shuffledOptional = shuffleArray(optionalPorts);
        for(let i = 0; i < numToSelect; i++) {
            currentOpenPorts.push({ ...shuffledOptional[i], is_closed: false });
        }
        
        // ★修正：ソートしてからレンダリングすることで、常にポート番号順に表示
        currentOpenPorts.sort((a, b) => a.port - b.port);

        // 初期リスク値を計算
        initialTotalRisk = currentOpenPorts.reduce((sum, port) => sum + (port.risk_value || 0), 0);
        risk = initialTotalRisk; // ゲーム開始時は合計リスク値からスタート

        renderPortList();
        updateStatusDisplay();
    }

    // 配列をシャッフルするヘルパー関数
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ポートリストのレンダリング
    function renderPortList() {
        portListElement.innerHTML = '';
        if (currentOpenPorts.length === 0) {
            portListElement.innerHTML = '<p style="text-align:center; color:#888;">全てのポートが閉じられました！</p>';
            // リスク0ならクリア判定
            if (risk <= 0 && usability >= 100 && gameActive) {
                endGame('ミッション成功');
            }
            return;
        }
        currentOpenPorts.forEach(port => {
            const portItem = document.createElement('div');
            portItem.classList.add('port-item');
            if (port.is_closed) portItem.classList.add('closed');
            portItem.dataset.portNumber = port.port;
            portItem.innerHTML = `
                <div class="port-info">
                    <span class="port-number">${port.port}</span>
                    <span class="port-service">${port.service}</span>
                    ${port.version ? `<span class="port-version">(${port.version})</span>` : ''}
                </div>
                <div class="port-actions">
                    <button class="investigate-button" data-port="${port.port}">調べる</button>
                    ${port.is_closed ? 
                        `<button class="release-button" data-port="${port.port}">解放</button>` :
                        `<button class="close-button-port" data-port="${port.port}">閉鎖</button>`
                    }
                </div>
            `;
            portListElement.appendChild(portItem);
        });

        // ボタンにイベントリスナーを設定
        document.querySelectorAll('.investigate-button').forEach(button => {
            button.onclick = (e) => showPortDetail(parseInt(e.target.dataset.port));
        });
        document.querySelectorAll('.release-button').forEach(button => {
            button.onclick = (e) => releasePort(parseInt(e.target.dataset.port));
        });
        document.querySelectorAll('.close-button-port').forEach(button => {
            button.onclick = (e) => closePort(parseInt(e.target.dataset.port));
        });
    }

    // ステータス表示の更新
    function updateStatusDisplay() {
        risk = Math.max(0, Math.min(risk, MAX_RISK));
        usability = Math.max(0, Math.min(usability, 100));

        riskLevelProgress.value = risk;
        riskValueSpan.textContent = `${risk} %`;
        usabilityLevelProgress.value = usability;
        usabilityValueSpan.textContent = `${usability} %`;

        riskLevelProgress.style.accentColor = (risk > 70) ? '#dc3545' : ((risk > 40) ? '#ffc107' : '#4CAF50');
        usabilityLevelProgress.style.accentColor = (usability < 30) ? '#dc3545' : ((usability < 60) ? '#ffc107' : '#007bff');

        // ゲーム勝利条件判定
        if (gameActive && risk <= 0 && usability >= 100) {
            endGame('ミッション成功');
        }
    }

    // 攻撃者ログの追加
    function addAttackerLog(logText, type = 'info') { 
        const logEntry = document.createElement('div');
        logEntry.classList.add('log-entry');
        logEntry.classList.add(`log-${type}`);
        
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        logEntry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-ip">${generateRandomIp()}</span> ${logText}`;
        
        attackerLogElement.prepend(logEntry);

        if (attackerLogElement.children.length > 50) {
            attackerLogElement.lastChild.remove();
        }
    }

    // ポート詳細表示モーダル
    function showPortDetail(portNumber) {
        const port = allPorts.find(p => p.port === portNumber);
        if (!port) return;

        modalPortTitle.textContent = `${port.port} / ${port.service} (${port.version || '不明'})`;
        modalPortUsage.textContent = port.usage;
        modalPortRisk.textContent = port.risk || '特筆すべきリスクはありません。';

        modalPortVulnerabilitySection.style.display = port.vulnerability ? 'block' : 'none';
        modalPortVulnerabilityText.textContent = port.vulnerability || '';

        modalPortHintSection.style.display = port.hint ? 'block' : 'none';
        modalPortHintText.textContent = port.hint || '';

        modal.style.display = 'flex';
    }

    // ポートを閉鎖する
    function closePort(portNumber) {
        if (!gameActive) return;

        const port = currentOpenPorts.find(p => p.port === portNumber);
        if (!port || port.is_closed) return;

        port.is_closed = true;

        if (port.type === 'required') {
            usability -= port.penalty_value;
            messageArea.textContent = `エラー！${port.port}番(${port.service})は必須ポートです！サービス可用性が低下しました。`;
            addAttackerLog(`[ALERT] 外部からの ${port.port}/TCP アクセスが困難になりました。サービス可用性が低下。`, 'critical');
        } else {
            risk -= port.risk_value;
            messageArea.textContent = `${port.port}番(${port.service})を閉鎖しました。サーバーリスクが軽減されました。`;
            addAttackerLog(`[INFO] 外部からの ${port.port}/TCP サービスが停止されました。`, 'info');
        }
        renderPortList();
        updateStatusDisplay();
    }

    // ポートを解放する (閉鎖したポートを再度開く)
    function releasePort(portNumber) {
        if (!gameActive) return;

        const port = currentOpenPorts.find(p => p.port === portNumber);
        if (!port || !port.is_closed) return;

        port.is_closed = false;

        if (port.type === 'required') {
            usability += port.penalty_value;
            messageArea.textContent = `${port.port}番(${port.service})を解放しました。サービス可用性が回復しました。`;
            addAttackerLog(`[INFO] 外部からの ${port.port}/TCP サービスが回復しました。`, 'info');
        } else {
            risk += port.risk_value;
            messageArea.textContent = `${port.port}番(${port.service})を解放しました。サーバーリスクが増加しました。`;
            addAttackerLog(`[WARNING] 外部からの ${port.port}/TCP サービスが再び開放されました。潜在的なリスク増加。`, 'warning');
        }
        renderPortList();
        updateStatusDisplay();
    }

    // 攻撃者ログの生成ロジック (リスク増減は行わない)
    function generateAttackerLogs() {
        if (!gameActive) return;

        const activePorts = currentOpenPorts.filter(p => !p.is_closed); // 開いているポート
        
        if (activePorts.length === 0) {
            addAttackerLog('[INFO] 攻撃対象のポートがありません。', 'info');
            return;
        }

        const targetPorts = activePorts.filter(p => p.risk_value > 0); // 危険なポートを優先的に攻撃
        const randomPort = (targetPorts.length > 0 ? targetPorts : activePorts)[Math.floor(Math.random() * (targetPorts.length > 0 ? targetPorts.length : activePorts.length))];
        if (!randomPort) return;

        const attackTypes = ['scan', 'exploit', 'bruteforce'];
        const randomAttackType = attackTypes[Math.floor(Math.random() * attackTypes.length)];

        let logMessage = '';
        let logType = 'info';

        if (randomAttackType === 'scan') {
            logMessage = `[SCAN] ${randomPort.port}/TCP へ接続試行。`;
        } else if (randomAttackType === 'bruteforce') {
            if (randomPort.service === 'SSH' || randomPort.service === 'RDP' || randomPort.service === 'Telnet') {
                logMessage = `[ATTACK] ${randomPort.port}/TCP (${randomPort.service}) へのブルートフォース攻撃を検知！`;
                logType = 'critical';
            } else {
                logMessage = `[SCAN] ${randomPort.port}/TCP へ不審な連続接続。`;
            }
        } else if (randomAttackType === 'exploit') {
            if (randomPort.type === 'vulnerable') {
                logMessage = `[ATTACK] ${randomPort.port}/TCP (${randomPort.service} ${randomPort.version}) への脆弱性エクスプロイト試行！`;
                logType = 'critical';
            } else {
                logMessage = `[SCAN] ${randomPort.port}/TCP へ不審なパケット。`;
            }
        }
        
        addAttackerLog(logMessage, logType);
        // updateStatusDisplay(); // ★修正：ログからのリスク増減がないため、ここでは不要
    }


    // ゲーム開始
    function startGame() {
        if (gameActive) return;

        initGame(); // 初期化
        gameActive = true;
        
        startGameButton.style.display = 'none';
        resetGameButton.style.display = 'block';
        messageArea.textContent = `ゲーム開始！開いているポートを調査し、不要なものを閉鎖しましょう。`;

        // 攻撃者ログの生成を継続的に開始
        attackLogIntervalId = setInterval(generateAttackerLogs, 3000); // 3秒ごと
    }

    // ゲーム終了 (クリア判定を含む)
    function endGame(reason) {
        // ゲームがクリアされた場合、ログ生成は継続せず、ゲームオーバーオーバーレイで結果を表示
        gameActive = false; // ゲーム自体は非アクティブに
        clearInterval(attackLogIntervalId); // ログ生成停止

        // 全てのポートボタンを無効化
        document.querySelectorAll('.port-actions button').forEach(btn => btn.disabled = true);

        let finalStatusText = '';
        let resultTitleText = '';
        if (reason === 'ミッション成功') {
            resultTitleText = 'ミッション達成！';
            finalStatusText = 'おめでとうございます！すべての不要なポートを閉じ、サーバーの安全性を維持しました！';
        } else {
            resultTitleText = 'ゲームオーバー！';
            if (risk > 0 && usability <= 0) {
                finalStatusText = 'サービス可用性が低下し、サーバーにもリスクが残っています。';
            } else if (risk > 0) {
                finalStatusText = 'まだサーバーにリスクが残っています。';
            } else if (usability <= 0) {
                finalStatusText = 'サービス可用性が低下しすぎました。';
            } else { // 想定外の終了
                finalStatusText = 'ゲームが終了しました。';
            }
        }
        
        const gameOverOverlay = document.createElement('div');
        gameOverOverlay.classList.add('game-over-overlay');
        gameOverOverlay.innerHTML = `
            <h2>${resultTitleText}</h2>
            <p id="result-final-status">${finalStatusText}</p>
            <div class="result-details">
                <p>最終サーバーリスク: <span id="final-risk-value">${risk} %</span></p>
                <p>最終可用性: <span id="final-usability-value">${usability} %</span></p>
            </div>
            <div class="result-analysis">
                <h3>あなたのポート管理は？</h3>
                <p id="analysis-text"></p>
            </div>
            <button id="restartgamebutton">もう一度プレイ</button>
        `;
        document.body.appendChild(gameOverOverlay);

        // 分析テキストの生成
        const analysisTextElement = gameOverOverlay.querySelector('#analysis-text');
        let analysis = '';
        if (risk <= 0 && usability >= 100) {
            analysis = '完璧なセキュリティ管理です！必要なサービスを止めずに、すべてのリスク要因を排除できました。';
        } else if (risk > 0 && usability >= 100) {
            analysis = 'まだ危険なポートが残っています。攻撃者はログに示されたポートから侵入を試みるかもしれません。';
        } else if (risk <= 0 && usability < 100) {
            analysis = 'リスクは排除できましたが、必要なサービスを停止してしまいました。可用性を維持することが重要です。';
        } else {
            analysis = 'サーバーリスクとサービス可用性の両方に課題が残りました。ポートの重要性を見極める練習が必要です。';
        }
        analysisTextElement.textContent = analysis;

        document.getElementById('restartgamebutton').onclick = () => {
            gameOverOverlay.remove();
            initGame(); // ゲームを初期状態に戻す
        };
    }

    // モーダルを閉じる
    modalCloseButton.onclick = () => {
        modal.style.display = 'none';
    };
    window.onclick = (event) => { // モーダル外クリックで閉じる
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
    document.addEventListener('keydown', (event) => { // Escキーで閉じる
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });

    // イベントリスナー設定
    startGameButton.addEventListener('click', startGame);
    resetGameButton.addEventListener('click', initGame);

    // ゲームの初期化 (初回ロード時)
    initGame();
});