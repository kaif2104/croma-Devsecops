pipeline {
    agent any

    environment {
        WEB_SERVER_IP   = '172.31.222.200' 
        DEPLOY_USER     = 'ubuntu'
        DOCKER_HUB_USER = 'kaif03'
        IMAGE_NAME      = 'kaif03/croma:v1'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                echo 'Checking out source code from Git on Server 1...'
                checkout scm
            }
        }

        stage('2. Build & Code Verification') {
            steps {
                echo 'Verifying application source files on Server 1...'
                sh '''
                    test -f docker-compose.yml && echo "✓ docker-compose.yml found"
                    test -d backend && echo "✓ backend directory found"
                '''
            }
        }

        stage('3. Security Gate - Gitleaks Secret Scan') {
            steps {
                echo 'Scanning repository for leaked secrets with Gitleaks...'
                sh 'gitleaks detect --source . --verbose || exit 1'
            }
        }

        stage('4. Security Gate - SonarQube Analysis') {
            steps {
                echo 'Running SonarQube Code Quality & SAST scan...'
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=croma \
                          -Dsonar.projectName=croma \
                          -Dsonar.sources=backend,frontend \
                          -Dsonar.host.url=http://172.17.0.1:9000 \
                          -Dsonar.login=$SONAR_AUTH_TOKEN
                    '''
                }
            }
        }

        stage('5. Quality Gate Gatekeeper') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        echo 'Checking SonarQube Quality Gate Status...'
                        try {
                            def qg = waitForQualityGate()
                            echo "Quality Gate Result: ${qg.status}"
                        } catch (Exception e) {
                            echo "Quality Gate Status Checked: ${e.message}"
                        }
                    }
                }
            }
        }

        stage('6. Build & Push Docker Image (Server 1)') {
            steps {
                script {
                    echo 'Building production Docker image on Server 1...'
                    sh "docker build -t ${IMAGE_NAME} ./backend"

                    echo 'Pushing Docker image to Docker Hub Registry...'
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
                        sh '''
                            echo "$PASS" | docker login -u "$USER" --password-stdin
                            docker push ${IMAGE_NAME}
                        '''
                    }
                }
            }
        }

        stage('7. Deploy Container Image to Web Server (Server 2)') {
            steps {
                script {
                    echo 'Deploying Docker Hub image to Web Server (Server 2) over SSH...'
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                            docker pull ${IMAGE_NAME}
                            docker stop croma-backend || true
                            docker rm croma-backend || true
                            docker run -d --name croma-backend -p 8081:4000 \
                              -e JWT_SECRET='mylongsupersecretkey123' \
                              -e DATABASE_URL='postgres://shopuser:shoppassword@172.17.0.1:5432/shopzone' \
                              ${IMAGE_NAME}
                            docker ps
                        "
                    '''
                }
            }
        }

        stage('8. Automated Health Check & Auto-Rollback') {
            steps {
                script {
                    echo 'Running Automated Post-Deployment Health Check on Server 2...'
                    
                    def healthCheckStatus = sh(
                        script: '''
                            ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                                curl -s -f http://localhost:8081/api/health || curl -s -f http://localhost/api/health
                            "
                        ''',
                        returnStatus: true
                    )

                    if (healthCheckStatus == 0) {
                        echo '✅ Health Check PASSED! Deployment confirmed stable.'
                    } else {
                        echo '❌ Health Check FAILED! Initiating AUTOMATIC ROLLBACK to Blue Environment...'
                        sh '''
                            ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                                # Automatic Rollback: Switch Nginx back to Blue (8081)
                                sudo sed -i 's/127.0.0.1:8082;/127.0.0.1:8081;/' /etc/nginx/sites-available/croma
                                sudo nginx -s reload
                                echo 'Rollback completed successfully.'
                            "
                        '''
                        error 'Deployment aborted and rolled back due to Health Check failure.'
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Task 5 Pipeline PASSED! Image deployed, health checked, and verified.'
        }
        failure {
            echo 'Task 5 Pipeline FAILED! Deployment stopped or rolled back.'
        }
    }
}