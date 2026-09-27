import { useState } from "preact/hooks";
import { useStatus } from "./status-box/status-context";
import { extractLinks } from "./utils";

export function UnlockForm({ addUnlockLinks }) {
  const { setStatus } = useStatus();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const formJson = Object.fromEntries(formData.entries());
    const links = extractLinks(formJson.links);

    if (links.length === 0) {
      setStatus(
        "error",
        "No valid links found. Links should start with http:// ou https://",
      );
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ links }),
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }
      addUnlockLinks(data.results);
    } catch (error) {
      setStatus("error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 className="mb-5 text-2xl font-semibold">
        Links to unlock
        <span className="text-sm font-normal text-base-content/50">
          {" "}
          (One link per line)
        </span>
      </h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="textarea mb-5 min-h-56 w-full leading-relaxed"
          name="links"
          placeholder="https://example.com/file1&#10;https://example.com/file2"
          rows={5}
          required
        ></textarea>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner" /> : "Unlock"}
          </button>
          <button type="reset" className="btn btn-outline flex-1" disabled={loading}>
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}
