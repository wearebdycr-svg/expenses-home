package co.wearebdycr.expenseshome;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private int lastTopDp = 48;
    private int lastBottomDp = 48;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Permitir que el sistema maneje el layout pero obteniendo los insets
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());

            int topPx = Math.max(bars.top, cutout.top);
            int bottomPx = Math.max(bars.bottom, cutout.bottom);
            float density = getResources().getDisplayMetrics().density;

            int topDp = topPx > 0 ? Math.round(topPx / density) : 48;
            int bottomDp = bottomPx > 0 ? Math.round(bottomPx / density) : 48;

            lastTopDp = topDp;
            lastBottomDp = bottomDp;

            applyInsetsToWebView(topDp, bottomDp);

            return windowInsets;
        });
    }

    private void applyInsetsToWebView(int topDp, int bottomDp) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            String js = String.format(
                "document.documentElement.style.setProperty('--safe-area-top', '%dpx');" +
                "document.documentElement.style.setProperty('--safe-area-bottom', '%dpx');",
                topDp, bottomDp
            );
            webView.post(() -> webView.evaluateJavascript(js, null));
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.postDelayed(() -> applyInsetsToWebView(lastTopDp, lastBottomDp), 300);
            webView.postDelayed(() -> applyInsetsToWebView(lastTopDp, lastBottomDp), 1000);
        }
    }
}
