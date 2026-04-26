import { useNavigate } from 'react-router-dom'
import { RedTeamLab } from '../components/RedTeamLab'

export function LandingPage() {
  const navigate = useNavigate()
  return <RedTeamLab onEnterPortfolio={() => navigate('/portfolio')} />
}
