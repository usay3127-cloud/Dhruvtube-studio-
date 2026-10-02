package com.dhruv.dhruvtube;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.speech.tts.TextToSpeech;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private WebView webView;
    private Process nodeProcess;

    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;
    private boolean welcomeSpoken = false;

    private final ExecutorService executor =
            Executors.newCachedThreadPool();

    private final Handler handler =
            new Handler();

    private File serverDir;
    private File runtimeDir;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);

                handler.postDelayed(() -> {
                    speakWelcome();
                }, 700);
            }
        });

        initTextToSpeech();
        startNodeServer();
    }

    private void initTextToSpeech() {

        textToSpeech = new TextToSpeech(
                getApplicationContext(),
                status -> {

                    if (status == TextToSpeech.SUCCESS) {

                        int result = textToSpeech.setLanguage(
                                Locale.ENGLISH
                        );

                        if (result != TextToSpeech.LANG_MISSING_DATA
                                && result != TextToSpeech.LANG_NOT_SUPPORTED) {

                            textToSpeech.setSpeechRate(0.9f);
                            textToSpeech.setPitch(1.0f);

                            ttsReady = true;

                            handler.postDelayed(() -> {
                                speakWelcome();
                            }, 3000);
                        }
                    }
                }
        );
    }

    private void speakWelcome() {

        if (!ttsReady || welcomeSpoken || textToSpeech == null) {
            return;
        }

        welcomeSpoken = true;

        textToSpeech.speak(
                "Welcome to DhruvTube",
                TextToSpeech.QUEUE_FLUSH,
                null,
                "dhruvtube_welcome"
        );
    }

    private void startNodeServer() {

        executor.execute(() -> {

            try {

                runtimeDir = new File(
                        getFilesDir(),
                        "node_runtime"
                );

                serverDir = new File(
                        getFilesDir(),
                        "server_bundle"
                );

                copyAssetTree(
                        "node_runtime",
                        runtimeDir
                );

                copyAssetTree(
                        "server_bundle",
                        serverDir
                );

                File node = new File(
                        getApplicationInfo().nativeLibraryDir,
                        "libnode.so"
                );

                if (!node.exists()) {
                    throw new IOException(
                            "Node native library missing: "
                                    + node.getAbsolutePath()
                    );
                }

                File runtimeLibDir = new File(
                        runtimeDir,
                        "lib"
                );

                File nativeLibDir = new File(
                        getApplicationInfo().nativeLibraryDir
                );

                String ldLibraryPath =
                        runtimeLibDir.getAbsolutePath()
                                + ":"
                                + nativeLibDir.getAbsolutePath();

                File serverJs = new File(
                        serverDir,
                        "server.js"
                );

                if (!serverJs.exists()) {
                    throw new IOException(
                            "server.js missing: "
                                    + serverJs.getAbsolutePath()
                    );
                }

                ProcessBuilder pb = new ProcessBuilder(
                        node.getAbsolutePath(),
                        serverJs.getAbsolutePath()
                );

                pb.directory(serverDir);
                pb.redirectErrorStream(true);

                pb.environment().put(
                        "LD_LIBRARY_PATH",
                        ldLibraryPath
                );

                pb.environment().put(
                        "NODE_PATH",
                        new File(
                                serverDir,
                                "node_modules"
                        ).getAbsolutePath()
                );

                pb.environment().put(
                        "HOME",
                        getFilesDir().getAbsolutePath()
                );

                nodeProcess = pb.start();

                executor.execute(() -> {

                    try {

                        InputStream output =
                                nodeProcess.getInputStream();

                        byte[] buffer = new byte[1024];
                        int count;

                        while ((count = output.read(buffer)) != -1) {

                            String line =
                                    new String(
                                            buffer,
                                            0,
                                            count
                                    );

                            android.util.Log.d(
                                    "DhruvTubeNode",
                                    line
                            );
                        }

                    } catch (Exception e) {

                        android.util.Log.e(
                                "DhruvTubeNode",
                                "Node output error",
                                e
                        );
                    }
                });

                waitForServer();

            } catch (Exception e) {

                android.util.Log.e(
                        "DhruvTubeNode",
                        "Node startup failed",
                        e
                );

                handler.post(() -> {

                    if (webView != null) {

                        webView.loadData(
                                "<html><body>"
                                        + "<h2>DhruvTube server failed to start</h2>"
                                        + "<pre>"
                                        + e.toString()
                                        + "</pre>"
                                        + "</body></html>",
                                "text/html",
                                "UTF-8"
                        );
                    }
                });
            }
        });
    }

    private void waitForServer() {

        final int maxAttempts = 30;

        for (int attempt = 0; attempt < maxAttempts; attempt++) {

            if (nodeProcess == null || !nodeProcess.isAlive()) {

                handler.post(() -> {

                    if (webView != null) {

                        webView.loadData(
                                "<html><body>"
                                        + "<h2>DhruvTube server stopped</h2>"
                                        + "<p>Node server could not stay running.</p>"
                                        + "</body></html>",
                                "text/html",
                                "UTF-8"
                        );
                    }
                });

                return;
            }

            HttpURLConnection connection = null;

            try {

                URL url = new URL(
                        "http://127.0.0.1:3000/"
                );

                connection =
                        (HttpURLConnection) url.openConnection();

                connection.setConnectTimeout(500);
                connection.setReadTimeout(500);
                connection.setRequestMethod("GET");

                int responseCode =
                        connection.getResponseCode();

                if (responseCode >= 200
                        && responseCode < 500) {

                    handler.post(() -> {

                        if (webView != null) {

                            webView.loadUrl(
                                    "http://127.0.0.1:3000/"
                            );
                        }
                    });

                    return;
                }

            } catch (Exception ignored) {

            } finally {

                if (connection != null) {
                    connection.disconnect();
                }
            }

            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }

        handler.post(() -> {

            if (webView != null) {

                webView.loadData(
                        "<html><body>"
                                + "<h2>DhruvTube server timeout</h2>"
                                + "<p>Server did not become ready.</p>"
                                + "</body></html>",
                        "text/html",
                        "UTF-8"
                );
            }
        });
    }

    private void copyAssetTree(
            String assetPath,
            File destination
    ) throws IOException {

        String[] children =
                getAssets().list(assetPath);

        if (children == null || children.length == 0) {

            copyAssetFile(
                    assetPath,
                    destination
            );

            return;
        }

        if (!destination.exists()
                && !destination.mkdirs()) {

            throw new IOException(
                    "Cannot create: "
                            + destination
            );
        }

        for (String child : children) {

            copyAssetTree(
                    assetPath + "/" + child,
                    new File(
                            destination,
                            child
                    )
            );
        }
    }

    private void copyAssetFile(
            String assetPath,
            File destination
    ) throws IOException {

        File parent =
                destination.getParentFile();

        if (parent != null
                && !parent.exists()
                && !parent.mkdirs()) {

            throw new IOException(
                    "Cannot create parent: "
                            + parent
            );
        }

        try (
                InputStream input =
                        getAssets().open(assetPath);

                FileOutputStream output =
                        new FileOutputStream(destination)
        ) {

            byte[] buffer = new byte[8192];
            int length;

            while ((length = input.read(buffer)) != -1) {

                output.write(
                        buffer,
                        0,
                        length
                );
            }
        }
    }

    @Override
    protected void onDestroy() {

        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }

        if (nodeProcess != null) {
            nodeProcess.destroy();
            nodeProcess = null;
        }

        executor.shutdownNow();

        if (webView != null) {
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

    @Override
    public void onBackPressed() {

        if (webView != null
                && webView.canGoBack()) {

            webView.goBack();

        } else {

            super.onBackPressed();
        }
    }
}
