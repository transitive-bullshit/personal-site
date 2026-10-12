'use client'

import { useId, useState } from 'react'
import { repairPaths, titles } from '@/lib/content/essays/cyber-swarm/evidence'
import type { RepairEstate } from '@/lib/content/essays/cyber-swarm/evidence'

export function ProtectionPaths({
  sourceLabels
}: {
  sourceLabels: { mandia: number; nist: number; dLink: number }
}) {
  const [estate, setEstate] = useState<RepairEstate>('legacy')
  const [containment, setContainment] = useState(false)
  const id = useId()
  const path = repairPaths[estate]
  return (
    <details id='protection-paths' className='protection-explorable'>
      <summary>
        Explore why the same finding leads to different protection
      </summary>
      <div className='protection-inner'>
        <p className='eyebrow'>Repair paths</p>
        <h3>{titles.protectionPaths}</h3>
        <fieldset className='estate-controls'>
          <legend>Change the system</legend>
          {(Object.keys(repairPaths) as RepairEstate[]).map((key) => (
            <label key={key} data-active={estate === key}>
              <input
                type='radio'
                name={`${id}-estate`}
                checked={estate === key}
                onChange={() => setEstate(key)}
              />
              {repairPaths[key].label}
            </label>
          ))}
        </fieldset>
        <label className='containment-control'>
          <input
            type='checkbox'
            checked={containment}
            onChange={(e) => setContainment(e.target.checked)}
          />
          Add an installed control that can block this attack
        </label>
        <div
          className='containment-path'
          data-active={containment}
          aria-label='Containment path'
        >
          <span>Incoming attempt</span>
          <span aria-hidden='true'>→</span>
          <strong>
            {containment
              ? 'Blocked by the installed control'
              : 'No blocking control assumed'}
          </strong>
        </div>
        <p className='path-label'>Permanent repair path</p>
        <div className='repair-path' aria-label='Permanent repair path'>
          {path.stages.map((stage, i) => (
            <div
              className='repair-node'
              data-gap={estate === 'unsupported' && i === 1}
              key={`${estate}-${i}`}
            >
              <span className='path-dot' aria-hidden='true' />
              <span>{stage}</span>
              {i < 2 && <span className='path-connector' aria-hidden='true' />}
            </div>
          ))}
        </div>
        <div
          className='protection-result'
          role='status'
          aria-live='polite'
          aria-atomic='true'
        >
          <strong>
            {containment
              ? 'Containment can protect before repair.'
              : path.outcome}
          </strong>
          <p>{path.note}</p>
          {containment && (
            <p>
              Assume the control has reach and authority over this attack path.
              It buys time; it does not cover every weakness.
            </p>
          )}
        </div>
        <p className='visual-source'>
          Containment buys time for permanent repair.{' '}
          <a href='#source-6'>Mandia [{sourceLabels.mandia}]</a> ·{' '}
          <a href='#source-13'>NIST [{sourceLabels.nist}]</a> ·{' '}
          <a href='#source-14'>D-Link [{sourceLabels.dLink}]</a>
        </p>
        <details className='visual-details'>
          <summary>Read all three scenarios</summary>
          <ul>
            {Object.values(repairPaths).map((p) => (
              <li key={p.label}>
                <strong>{p.label}.</strong> {p.note}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </details>
  )
}
