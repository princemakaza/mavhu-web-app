export function Brand({ size = 40 }: { size?: number }) {
  return (
    <span className="brand">
      <span className="brand__mark" style={{ width: size, height: size }}>
        <img src="/logo.png" alt="" width={size} height={size} />
      </span>
      <span className="brand__word">
        Mavhu<span> Africa</span>
      </span>
    </span>
  );
}
