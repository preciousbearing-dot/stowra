package app.stowra.vault;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StowraNativePlugin.class);
        registerPlugin(StowraUpdatePlugin.class);
        registerPlugin(StowraMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
