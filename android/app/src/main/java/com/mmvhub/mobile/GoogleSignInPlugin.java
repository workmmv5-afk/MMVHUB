package com.mmvhub.mobile;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Native Google sign-in via Android Credential Manager. Returns a Google ID
 * token; the web app exchanges it with Firebase Auth
 * (GoogleAuthProvider.credential → signInWithCredential), so no Firebase
 * Android SDK or google-services.json is needed.
 */
@CapacitorPlugin(name = "MmvGoogleAuth")
public class GoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("serverClientId");
        if (clientId == null || clientId.isEmpty()) {
            call.reject("Missing web client id", "CONFIG");
            return;
        }
        GetGoogleIdOption option = new GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(clientId)
            .setAutoSelectEnabled(false)
            .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build();
        CredentialManager cm = CredentialManager.create(getContext());
        cm.getCredentialAsync(
            getActivity(),
            request,
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential c = response.getCredential();
                    if (c instanceof CustomCredential
                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                        try {
                            GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                            JSObject ret = new JSObject();
                            ret.put("idToken", g.getIdToken());
                            ret.put("email", g.getId());
                            ret.put("displayName", g.getDisplayName());
                            call.resolve(ret);
                        } catch (Exception e) {
                            call.reject("Invalid Google credential", "INVALID", e);
                        }
                    } else {
                        call.reject("Unexpected credential type", "INVALID");
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    String code = e instanceof GetCredentialCancellationException ? "CANCELLED"
                        : e instanceof NoCredentialException ? "NO_ACCOUNT"
                        : "FAILED";
                    call.reject(e.getMessage() != null ? e.getMessage() : code, code, e);
                }
            }
        );
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        CredentialManager.create(getContext()).clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void unused) {
                    call.resolve();
                }

                @Override
                public void onError(ClearCredentialException e) {
                    call.resolve(); // best effort
                }
            }
        );
    }
}
