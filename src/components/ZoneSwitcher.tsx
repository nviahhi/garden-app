import { useZoneStore } from '../store/useZoneStore';
import { ZONE_TYPE_EMOJI } from '../types';

interface ZoneSwitcherProps {
  onSwitch: () => void;
  onCreate: () => void;
  onEdit: () => void;
}

export function ZoneSwitcher({ onSwitch, onCreate, onEdit }: ZoneSwitcherProps) {
  const zones = useZoneStore((s) => s.zones);
  const currentZone = useZoneStore((s) => s.currentZone);
  const selectZone = useZoneStore((s) => s.selectZone);

  const handleSelect = async (id: number) => {
    if (id === currentZone?.id) return;
    await selectZone(id);
    onSwitch();
  };

  return (
    <div className="zone-switcher">
      <div className="zone-tabs">
        {zones.map((zone) => (
          <button
            key={zone.id}
            className={`zone-tab ${currentZone?.id === zone.id ? 'is-active' : ''}`}
            onClick={() => handleSelect(zone.id)}
            title={zone.name}
          >
            <span className="zone-tab-emoji">{ZONE_TYPE_EMOJI[zone.type]}</span>
            <span className="zone-tab-name">{zone.name}</span>
          </button>
        ))}
        <button className="zone-tab zone-tab-add" onClick={onCreate} title="Добавить зону">
          +
        </button>
      </div>

      {currentZone && (
        <button className="btn-icon" onClick={onEdit} title="Редактировать зону">
          ⚙️
        </button>
      )}
    </div>
  );
}