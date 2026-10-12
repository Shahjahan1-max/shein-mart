import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { User, Mail, Phone, Globe, Camera, Edit2, Check, X, LogOut, Loader2 } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { uploadUserProfileImage, useTeamMembers } from "../../hooks/useApi";
import { toast } from "../../hooks/use-toast";

const AVATAR_CANVAS_SIZE = 512;
const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image. Please choose another picture."));
    };
    image.src = url;
  });
}

async function prepareAvatarUpload(file: File): Promise<{ dataUrl: string; contentType: string }> {
  const image = await loadImageFromFile(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("Could not read this image. Please choose another picture.");

  const sourceSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, Math.floor((sourceWidth - sourceSize) / 2));
  const sourceY = Math.max(0, Math.floor((sourceHeight - sourceSize) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_CANVAS_SIZE;
  canvas.height = AVATAR_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE);
  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), contentType: "image/jpeg" };
}

export function Profile() {
  const [, navigate] = useLocation();
  const { user, logout, updateUser } = useAuth();
  const { t } = useLang();
  const [editField, setEditField] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: users = [] } = useTeamMembers(user?.id, user?.referralCode);
  const referralCount = useMemo(
    () => users.filter(item => item.referredByUserId === user?.id || item.referredBy === user?.referralCode).length,
    [users, user?.id, user?.referralCode],
  );

  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const avatarSrc = avatarLoadFailed ? null : (avatarPreview || user?.profileImage || null);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarPreview, user?.profileImage]);

  const startEdit = (field: string, value: string) => { setEditField(field); setEditVal(value); };
  const saveEdit = () => { if (!editField || !editVal.trim()) { setEditField(null); return; } updateUser({ [editField]: editVal.trim() }); setEditField(null); };
  const cancelEdit = () => setEditField(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!user?.id) {
      toast({ title: "Please sign in again", description: "We could not find your account session.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      toast({ title: "Image is too large", description: "Please choose an image under 10 MB.", variant: "destructive" });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const prepared = await prepareAvatarUpload(file);
      setAvatarPreview(prepared.dataUrl);
      const uploaded = await uploadUserProfileImage(user.id, {
        dataUrl: prepared.dataUrl,
        fileName: file.name || "profile-image.jpg",
        contentType: prepared.contentType,
      });
      const profileImage = uploaded.profileImage || uploaded.user?.profileImage;
      if (!profileImage) throw new Error("Profile image uploaded but no image URL was returned.");
      setAvatarPreview(profileImage);
      void updateUser({ profileImage }).catch(() => {});
      window.dispatchEvent(new CustomEvent("ds:data-changed", { detail: { collection: "users", id: user.id } }));
      toast({ title: "Profile photo saved", description: "Your picture will now show across your account." });
    } catch (error) {
      setAvatarPreview(null);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const FIELDS = [
    { key: "name",    label: t("fullName"),     icon: User,  value: user?.name ?? "—" },
    { key: "email",   label: t("emailLabel"),   icon: Mail,  value: user?.email ?? "—", readonly: true },
    { key: "phone",   label: t("phoneLabel"),   icon: Phone, value: user?.phone || t("notSet") },
    { key: "country", label: t("countryLabel"), icon: Globe, value: user?.country ?? "—" },
  ];

  return (
    <DashboardLayout showBack title={t("profile")} backTo="/dashboard/mine">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar + identity card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="relative mb-4">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" onError={() => setAvatarLoadFailed(true)} className="h-24 w-24 rounded-full object-cover border-4 border-[#254C73]/30 shadow-md" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#254C73] to-[#14283E] flex items-center justify-center text-white text-2xl font-extrabold shadow-md border-4 border-[#254C73]/30">{initials}</div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isUploadingAvatar}
                aria-label="Upload profile photo"
                title="Upload profile photo"
                className="absolute bottom-0 right-0 p-2 bg-[#254C73] hover:bg-[#1B365D] disabled:opacity-50 text-white rounded-full shadow-md transition-colors border-2 border-white dark:border-gray-800"
              >
                {isUploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">{user?.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-3">{user?.email}</p>
            <div className="px-3 py-1.5 bg-[#254C73]/10 dark:bg-[#254C73]/30 rounded-full text-xs font-bold text-[#254C73] dark:text-blue-300 mb-4">
              {t("referralCode")}: {user?.referralCode}
            </div>
            <div className="w-full grid grid-cols-2 gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="text-center">
                <p className="text-base font-extrabold text-gray-900 dark:text-white">{(user?.balance ?? 0).toFixed(2)}</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">{t("balanceUsdt")}</p>
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-gray-900 dark:text-white">{referralCount}</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">{t("referrals")}</p>
              </div>
            </div>
            <button onClick={() => { logout(); navigate("/"); }} className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
              <LogOut className="h-4 w-4" /> {t("signOut")}
            </button>
          </div>

          {/* Account info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-50 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("accountInformation")}</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-4 px-5 py-4">
                    <div className="p-2 bg-[#254C73]/10 dark:bg-[#254C73]/20 rounded-xl flex-shrink-0">
                      <f.icon className="h-4 w-4 text-[#254C73] dark:text-blue-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500">{f.label}</p>
                      {editField === f.key ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border-b-2 border-purple-500 outline-none text-gray-900 dark:text-white" />
                          <button onClick={saveEdit} className="text-green-600 hover:text-green-700 transition-colors"><Check className="h-4 w-4" /></button>
                          <button onClick={cancelEdit} className="text-red-400 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{f.value}</p>
                      )}
                    </div>
                    {!f.readonly && editField !== f.key && (
                      <button onClick={() => startEdit(f.key, f.value)} className="text-slate-500 dark:text-gray-400 hover:text-purple-600 transition-colors flex-shrink-0">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-gray-300 dark:text-gray-600">
              DealX Stocks v1.0 · {t("memberSince")} {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "today"}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
