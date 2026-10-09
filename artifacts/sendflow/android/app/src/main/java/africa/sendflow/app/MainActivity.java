package africa.sendflow.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            // Android disables third-party cookies by default for modern targets.
            // SendFlow's remote API uses a Secure, HttpOnly SameSite=None session cookie.
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
    }
}
