export const ok = (res, data, message = "OK", status = 200) =>
  res.status(status).json({ success: true, data, message });

export const created = (res, data, message = "Created") =>
  res.status(201).json({ success: true, data, message });

export const noContent = (res) => res.status(204).end();

export const fail = (res, status, message, errors = []) =>
  res.status(status).json({ success: false, message, errors });
