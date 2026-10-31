package ru.youchat.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Отдаёт системному установщику скачанный APK из папки cache/apk (только чтение, без экспорта). */
public class YCFiles extends ContentProvider {
    static final String AUTH = "ru.youchat.app.files";

    static Uri uriFor(Context c, File f) {
        return new Uri.Builder().scheme("content").authority(AUTH).appendPath("apk").appendPath(f.getName()).build();
    }

    File fileFor(Uri u) throws FileNotFoundException {
        if (getContext() == null || u.getPathSegments().size() != 2 || !"apk".equals(u.getPathSegments().get(0))) throw new FileNotFoundException();
        String n = u.getLastPathSegment();
        if (n == null || n.contains("/") || n.contains("..") || !n.endsWith(".apk")) throw new FileNotFoundException();
        File f = new File(new File(getContext().getCacheDir(), "apk"), n);
        if (!f.exists()) throw new FileNotFoundException();
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) { return "application/vnd.android.package-archive"; }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("read only");
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] proj, String sel, String[] args, String sort) {
        try {
            File f = fileFor(uri);
            MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[]{f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) { return null; }
    }

    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
