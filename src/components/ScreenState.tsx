import clsx from "clsx";

export const LoadingScreen = ({
  label,
  inset,
}: {
  label: string;
  inset?: boolean;
}) => {
  return (
    <div
      className={clsx(
        "grid min-h-[50vh] place-items-center rounded-[32px] border border-white/70 bg-white/80 p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]",
        !inset && "min-h-screen rounded-none border-none shadow-none",
      )}
    >
      <div>
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
        <p className="mt-5 text-base text-slate-500">{label}</p>
      </div>
    </div>
  );
};

export const ErrorScreen = ({
  message,
  inset,
}: {
  message: string;
  inset?: boolean;
}) => {
  return (
    <div
      className={clsx(
        "grid min-h-[50vh] place-items-center rounded-[32px] border border-rose-200 bg-rose-50 p-10 text-center",
        !inset && "min-h-screen rounded-none border-none",
      )}
    >
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-rose-500">API error</p>
        <p className="mt-3 max-w-xl text-lg text-rose-700">{message}</p>
      </div>
    </div>
  );
};

export const EmptyScreen = () => {
  return (
    <div className="grid min-h-[50vh] place-items-center rounded-[32px] border border-slate-200 bg-white/80 p-10 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">No data</p>
        <p className="mt-3 max-w-xl text-lg text-slate-600">
          Select a user and scoring date to load a reliability assessment.
        </p>
      </div>
    </div>
  );
};
