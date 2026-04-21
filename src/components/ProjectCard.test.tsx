import { screen } from '@testing-library/react'
import { ProjectCard } from './ProjectCard'
import { projects } from '../data/projects'
import { renderWithProviders } from '../test/render'

describe('ProjectCard', () => {
  it('renders the project title and summary', () => {
    renderWithProviders(<ProjectCard project={projects[0]} />)

    expect(screen.getByText('MCP Security Framework')).toBeInTheDocument()
    expect(screen.getAllByText(/14 detectors/i).length).toBeGreaterThanOrEqual(1)
  })

  it('card is a full link to the case study', () => {
    renderWithProviders(<ProjectCard project={projects[0]} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/projects/${projects[0].slug}`)
  })

  it('renders status chip', () => {
    renderWithProviders(<ProjectCard project={projects[0]} />)

    expect(screen.getByText('FLAGSHIP')).toBeInTheDocument()
  })
})
