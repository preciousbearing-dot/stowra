package app.stowra.vault;

import androidx.core.content.FileProvider;

/** Lets the Android installer read the downloaded update file. Only the update folder is shared. */
public class StowraUpdateProvider extends FileProvider {}
